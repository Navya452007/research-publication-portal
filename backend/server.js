const dns = require("dns");

dns.setServers(["8.8.8.8"]);

const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { MongoClient, ObjectId } = require("mongodb");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const client = new MongoClient(process.env.MONGO_URI);

const db = client.db("research_portal");

const usersCollection = db.collection("users");
const publicationsCollection = db.collection("publications");
const departmentsCollection = db.collection("departments");

const app = express();

client.connect()
    .then(() => {
        console.log("MongoDB connected successfully");
    })
    .catch((error) => {
        console.log("MongoDB connection failed:", error);
    });

app.use(cors());
app.use(express.json());


// ==================== HOME ====================

app.get("/", (req, res) => {
    res.send("Research Publication Management Portal Backend");
});


// ==================== REGISTER ====================

app.post("/register", async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        const existingUser = await usersCollection.findOne({ email });

        if (existingUser) {
            return res.status(400).json({
                message: "Email already registered"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = {
            name: name,
            email: email,
            password: hashedPassword,
            role: role || "faculty"
        };

        const result = await usersCollection.insertOne(user);

        res.status(201).json({
            message: "User registered successfully",
            userId: result.insertedId
        });

    } catch (error) {
        console.log(error);

        res.status(500).json({
            message: "Registration failed"
        });
    }
});


// ==================== LOGIN ====================

app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await usersCollection.findOne({ email });

        if (!user) {
            return res.status(400).json({
                message: "Invalid email or password"
            });
        }

        const isPasswordCorrect = await bcrypt.compare(
            password,
            user.password
        );

        if (!isPasswordCorrect) {
            return res.status(400).json({
                message: "Invalid email or password"
            });
        }

        const token = jwt.sign(
            {
                userId: user._id.toString(),
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1d"
            }
        );

        res.json({
            message: "Login successful",
            token: token,
            role: user.role
        });

    } catch (error) {
        console.log(error);

        res.status(500).json({
            message: "Login failed"
        });
    }
});


// ==================== AUTHENTICATION ====================

function authenticateToken(req, res, next) {

    const authHeader = req.headers["authorization"];

    const token =
        authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            message: "Access token required"
        });
    }

    jwt.verify(
        token,
        process.env.JWT_SECRET,
        (error, user) => {

            if (error) {
                return res.status(403).json({
                    message: "Invalid or expired token"
                });
            }

            req.user = user;

            next();
        }
    );
}


// ==================== ADMIN AUTHENTICATION ====================

function adminOnly(req, res, next) {

    if (req.user.role !== "admin") {
        return res.status(403).json({
            message: "Admin access required"
        });
    }

    next();
}


// ==================== ADD PUBLICATION ====================

app.post(
    "/publications",
    authenticateToken,
    async (req, res) => {

        try {

            const {
                paperTitle,
                publicationType,
                journalConference,
                publicationYear,
                DOI
            } = req.body;

            const publication = {

                facultyId: req.user.userId,

                paperTitle: paperTitle,

                publicationType: publicationType,

                journalConference: journalConference,

                publicationYear: publicationYear,

                DOI: DOI,

                verificationStatus: "Pending",

                createdAt: new Date()
            };

            const result =
                await publicationsCollection.insertOne(
                    publication
                );

            res.status(201).json({

                message: "Publication added successfully",

                publicationId: result.insertedId

            });

        } catch (error) {

            console.log(error);

            res.status(500).json({

                message: "Failed to add publication"

            });
        }
    }
);


// ==================== GET PUBLICATIONS ====================

app.get(
    "/publications",
    authenticateToken,
    async (req, res) => {

        try {

            let publications;

            if (req.user.role === "admin") {

                publications =
                    await publicationsCollection
                        .find({})
                        .toArray();

            } else {

                publications =
                    await publicationsCollection
                        .find({
                            facultyId: req.user.userId
                        })
                        .toArray();
            }

            res.json(publications);

        } catch (error) {

            console.log(error);

            res.status(500).json({

                message: "Failed to fetch publications"

            });
        }
    }
);


// ==================== SEARCH PUBLICATIONS ====================

app.get(
    "/publications/search",
    authenticateToken,
    async (req, res) => {

        try {

            const title =
                req.query.title || "";

            const publications =
                await publicationsCollection
                    .find({
                        paperTitle: {
                            $regex: title,
                            $options: "i"
                        }
                    })
                    .toArray();

            res.json(publications);

        } catch (error) {

            console.log(error);

            res.status(500).json({

                message: "Search failed"

            });
        }
    }
);


// ==================== UPDATE PUBLICATION ====================

app.put(
    "/publications/:id",
    authenticateToken,
    async (req, res) => {

        try {

            const publicationId =
                req.params.id;

            const publication =
                await publicationsCollection.findOne({
                    _id: new ObjectId(publicationId)
                });

            if (!publication) {

                return res.status(404).json({

                    message: "Publication not found"

                });
            }

            if (
                req.user.role !== "admin" &&
                publication.facultyId !== req.user.userId
            ) {

                return res.status(403).json({

                    message:
                        "You can update only your publications"

                });
            }

            const updateData = {

                paperTitle:
                    req.body.paperTitle,

                publicationType:
                    req.body.publicationType,

                journalConference:
                    req.body.journalConference,

                publicationYear:
                    req.body.publicationYear,

                DOI:
                    req.body.DOI
            };

            if (req.user.role === "admin") {

                updateData.verificationStatus =
                    req.body.verificationStatus ||
                    publication.verificationStatus;
            }

            await publicationsCollection.updateOne(

                {
                    _id: new ObjectId(publicationId)
                },

                {
                    $set: updateData
                }
            );

            res.json({

                message:
                    "Publication updated successfully"

            });

        } catch (error) {

            console.log(error);

            res.status(500).json({

                message:
                    "Failed to update publication"

            });
        }
    }
);


// ==================== DELETE PUBLICATION ====================

app.delete(
    "/publications/:id",
    authenticateToken,
    async (req, res) => {

        try {

            const publicationId =
                req.params.id;

            const publication =
                await publicationsCollection.findOne({

                    _id:
                        new ObjectId(publicationId)

                });

            if (!publication) {

                return res.status(404).json({

                    message:
                        "Publication not found"

                });
            }

            if (
                req.user.role !== "admin" &&
                publication.facultyId !== req.user.userId
            ) {

                return res.status(403).json({

                    message:
                        "You can delete only your publications"

                });
            }

            await publicationsCollection.deleteOne({

                _id:
                    new ObjectId(publicationId)

            });

            res.json({

                message:
                    "Publication deleted successfully"

            });

        } catch (error) {

            console.log(error);

            res.status(500).json({

                message:
                    "Failed to delete publication"

            });
        }
    }
);


// ==================== VERIFY PUBLICATION ====================

app.put(
    "/publications/:id/verify",
    authenticateToken,
    adminOnly,
    async (req, res) => {

        try {

            const publicationId =
                req.params.id;

            const status =
                req.body.verificationStatus ||
                "Verified";

            await publicationsCollection.updateOne(

                {
                    _id:
                        new ObjectId(publicationId)
                },

                {
                    $set: {
                        verificationStatus:
                            status
                    }
                }
            );

            res.json({

                message:
                    "Publication verification status updated",

                verificationStatus:
                    status

            });

        } catch (error) {

            console.log(error);

            res.status(500).json({

                message:
                    "Verification failed"

            });
        }
    }
);


// ==================== GET DEPARTMENTS ====================

app.get(
    "/departments",
    authenticateToken,
    async (req, res) => {

        try {

            const departments =
                await departmentsCollection
                    .find({})
                    .toArray();

            res.json(departments);

        } catch (error) {

            console.log(error);

            res.status(500).json({

                message:
                    "Failed to fetch departments"

            });
        }
    }
);


// ==================== ADD DEPARTMENT ====================

app.post(
    "/departments",
    authenticateToken,
    adminOnly,
    async (req, res) => {

        try {

            const {
                departmentName,
                HODName,
                totalFaculty
            } = req.body;

            const department = {

                departmentName:
                    departmentName,

                HODName:
                    HODName,

                totalFaculty:
                    totalFaculty
            };

            const result =
                await departmentsCollection
                    .insertOne(department);

            res.status(201).json({

                message:
                    "Department added successfully",

                departmentId:
                    result.insertedId

            });

        } catch (error) {

            console.log(error);

            res.status(500).json({

                message:
                    "Failed to add department"

            });
        }
    }
);


// ==================== UPDATE DEPARTMENT ====================

app.put(
    "/departments/:id",
    authenticateToken,
    adminOnly,
    async (req, res) => {

        try {

            const departmentId =
                req.params.id;

            await departmentsCollection.updateOne(

                {
                    _id:
                        new ObjectId(departmentId)
                },

                {
                    $set: {

                        departmentName:
                            req.body.departmentName,

                        HODName:
                            req.body.HODName,

                        totalFaculty:
                            req.body.totalFaculty
                    }
                }
            );

            res.json({

                message:
                    "Department updated successfully"

            });

        } catch (error) {

            console.log(error);

            res.status(500).json({

                message:
                    "Failed to update department"

            });
        }
    }
);


// ==================== DELETE DEPARTMENT ====================

app.delete(
    "/departments/:id",
    authenticateToken,
    adminOnly,
    async (req, res) => {

        try {

            const departmentId =
                req.params.id;

            await departmentsCollection.deleteOne({

                _id:
                    new ObjectId(departmentId)

            });

            res.json({

                message:
                    "Department deleted successfully"

            });

        } catch (error) {

            console.log(error);

            res.status(500).json({

                message:
                    "Failed to delete department"

            });
        }
    }
);


// ==================== ADMIN REPORT ====================

app.get(
    "/admin/report",
    authenticateToken,
    adminOnly,
    async (req, res) => {

        try {

            const totalPublications =
                await publicationsCollection
                    .countDocuments();

            const verifiedPublications =
                await publicationsCollection
                    .countDocuments({
                        verificationStatus:
                            "Verified"
                    });

            const pendingPublications =
                await publicationsCollection
                    .countDocuments({
                        verificationStatus:
                            "Pending"
                    });

            const rejectedPublications =
                await publicationsCollection
                    .countDocuments({
                        verificationStatus:
                            "Rejected"
                    });

            const totalFaculty =
                await usersCollection
                    .countDocuments({
                        role: "faculty"
                    });

            res.json({

                totalFaculty:
                    totalFaculty,

                totalPublications:
                    totalPublications,

                verifiedPublications:
                    verifiedPublications,

                pendingPublications:
                    pendingPublications,

                rejectedPublications:
                    rejectedPublications

            });

        } catch (error) {

            console.log(error);

            res.status(500).json({

                message:
                    "Failed to generate report"

            });
        }
    }
);


// ==================== START SERVER ====================

app.listen(5000, () => {

    console.log(
        "Server is running on port 5000"
    );

});