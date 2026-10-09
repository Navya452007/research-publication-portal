const dns = require("dns");
dns.setServers(["8.8.8.8"]);

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const dotenv = require("dotenv");

dotenv.config();

const { MongoClient, ObjectId } = require("mongodb");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");


// ======================================================
// CONFIGURATION
// ======================================================

const PORT = process.env.PORT || 5000;

const MONGO_URI = process.env.MONGO_URI;

const JWT_SECRET = process.env.JWT_SECRET;

const DB_NAME = "research_portal";


if (!MONGO_URI) {
    console.error("ERROR: MONGO_URI is missing in .env");
    process.exit(1);
}

if (!JWT_SECRET) {
    console.error("ERROR: JWT_SECRET is missing in .env");
    process.exit(1);
}


// ======================================================
// MONGODB
// ======================================================

const client = new MongoClient(MONGO_URI);

const db = client.db(DB_NAME);

const usersCollection = db.collection("users");
const publicationsCollection = db.collection("publications");
const departmentsCollection = db.collection("departments");

const notificationsCollection =
    db.collection("notifications");

const activityLogsCollection =
    db.collection("activityLogs");


// ======================================================
// EXPRESS APP
// ======================================================

const app = express();


// Basic security headers

app.use((req, res, next) => {

    res.setHeader(
        "X-Content-Type-Options",
        "nosniff"
    );

    res.setHeader(
        "X-Frame-Options",
        "DENY"
    );

    res.setHeader(
        "Referrer-Policy",
        "strict-origin-when-cross-origin"
    );

    next();

});


app.use(cors());

app.use(express.json({ limit: "1mb" }));


// ======================================================
// HELPER FUNCTIONS
// ======================================================

function isValidObjectId(id) {

    return ObjectId.isValid(id);

}


function getObjectId(id) {

    return new ObjectId(id);

}


function escapeRegex(value) {

    return value.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );

}


function safePage(value) {

    const page = parseInt(value);

    if (!page || page < 1) {
        return 1;
    }

    return page;

}


function safeLimit(value) {

    const limit = parseInt(value);

    if (!limit || limit < 1) {
        return 10;
    }

    return Math.min(limit, 100);

}


function getSortDirection(value) {

    return value === "asc" ? 1 : -1;

}


function getSafeSortField(value) {

    const allowedFields = [

        "createdAt",
        "updatedAt",
        "paperTitle",
        "publicationYear",
        "publicationType",
        "verificationStatus"

    ];

    if (allowedFields.includes(value)) {

        return value;

    }

    return "createdAt";

}


// ======================================================
// ACTIVITY LOG
// ======================================================

async function createActivityLog({

    userId,
    action,
    entity,
    entityId,
    details = {}

}) {

    try {

        await activityLogsCollection.insertOne({

            userId:
                userId || null,

            action,

            entity,

            entityId:
                entityId || null,

            details,

            createdAt:
                new Date()

        });

    } catch (error) {

        console.log(
            "Activity log error:",
            error.message
        );

    }

}


// ======================================================
// NOTIFICATION
// ======================================================

async function createNotification({

    userId,
    title,
    message,
    type = "info",
    publicationId = null

}) {

    try {

        await notificationsCollection.insertOne({

            userId,

            title,

            message,

            type,

            publicationId,

            isRead: false,

            createdAt:
                new Date()

        });

    } catch (error) {

        console.log(
            "Notification error:",
            error.message
        );

    }

}


// ======================================================
// DATABASE INDEXES
// ======================================================

async function createIndexes() {

    try {

        await usersCollection.createIndex(
            { email: 1 },
            { unique: true }
        );


        await publicationsCollection.createIndex({
            facultyId: 1
        });


        await publicationsCollection.createIndex({
            verificationStatus: 1
        });


        await publicationsCollection.createIndex({
            publicationYear: 1
        });


        await publicationsCollection.createIndex({
            DOI: 1
        });


        await publicationsCollection.createIndex({
            paperTitle: "text"
        });


        await notificationsCollection.createIndex({
            userId: 1,
            createdAt: -1
        });


        await activityLogsCollection.createIndex({
            userId: 1,
            createdAt: -1
        });


        await activityLogsCollection.createIndex({
            createdAt: -1
        });


        console.log("MongoDB indexes ready");

    } catch (error) {

        console.log(
            "Index creation warning:",
            error.message
        );

    }

}


// ======================================================
// DATABASE CONNECTION
// ======================================================

async function connectDatabase() {

    try {

        await client.connect();

        console.log(
            "MongoDB connected successfully"
        );

        await createIndexes();

    } catch (error) {

        console.log(
            "MongoDB connection failed:",
            error
        );

        process.exit(1);

    }

}


// ======================================================
// HOME
// ======================================================

app.get("/", (req, res) => {

    res.json({

        success: true,

        message:
            "Research Publication Management Portal Backend",

        status:
            "Running",

        version:
            "2.0"

    });

});


// ======================================================
// REGISTER
// ======================================================

app.post("/register", async (req, res) => {

    try {

        const {
            name,
            email,
            password,
            role
        } = req.body;


        if (
            !name ||
            !email ||
            !password ||
            !role
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Name, email, password and role are required"

            });

        }


        // Convert role to lowercase
        const normalizedRole =
            String(role)
                .trim()
                .toLowerCase();


        // Only faculty/admin allowed
        if (
            normalizedRole !== "faculty" &&
            normalizedRole !== "admin"
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Role must be Faculty or Admin"

            });

        }


        if (password.length < 6) {

            return res.status(400).json({

                success: false,

                message:
                    "Password must contain at least 6 characters"

            });

        }


        const normalizedEmail =
            email.trim().toLowerCase();


        const existingUser =
            await usersCollection.findOne({

                email:
                    normalizedEmail

            });


        if (existingUser) {

            return res.status(400).json({

                success: false,

                message:
                    "Email already registered"

            });

        }


        const hashedPassword =
            await bcrypt.hash(
                password,
                10
            );


        const user = {

            name:
                name.trim(),

            email:
                normalizedEmail,

            password:
                hashedPassword,

            role:
                normalizedRole,

            createdAt:
                new Date(),

            updatedAt:
                new Date()

        };


        const result =
            await usersCollection.insertOne(
                user
            );


        await createActivityLog({

            userId:
                result.insertedId.toString(),

            action:
                "REGISTER",

            entity:
                "USER",

            entityId:
                result.insertedId.toString(),

            details: {

                email:
                    normalizedEmail,

                role:
                    normalizedRole

            }

        });


        res.status(201).json({

            success: true,

            message:
                "User registered successfully",

            userId:
                result.insertedId,

            role:
                normalizedRole

        });


    } catch (error) {

        console.log(error);

        res.status(500).json({

            success: false,

            message:
                "Registration failed"

        });

    }

});


// ======================================================
// LOGIN
// ======================================================

app.post("/login", async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;


        if (!email || !password) {

            return res.status(400).json({

                success: false,

                message:
                    "Email and password are required"

            });

        }


        const normalizedEmail =
            email.trim().toLowerCase();


        const user =
            await usersCollection.findOne({

                email:
                    normalizedEmail

            });


        if (!user) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid email or password"

            });

        }


        const passwordCorrect =
            await bcrypt.compare(
                password,
                user.password
            );


        if (!passwordCorrect) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid email or password"

            });

        }


        const token =
            jwt.sign(

                {

                    userId:
                        user._id.toString(),

                    role:
                        user.role

                },

                JWT_SECRET,

                {

                    expiresIn:
                        "1d"

                }

            );


        await createActivityLog({

            userId:
                user._id.toString(),

            action:
                "LOGIN",

            entity:
                "USER",

            entityId:
                user._id.toString()

        });


        res.json({

            success: true,

            message:
                "Login successful",

            token,

            role:
                user.role,

            user: {

                id:
                    user._id,

                name:
                    user.name,

                email:
                    user.email,

                role:
                    user.role

            }

        });


    } catch (error) {

        console.log(error);

        res.status(500).json({

            success: false,

            message:
                "Login failed"

        });

    }

});


// ======================================================
// AUTHENTICATION MIDDLEWARE
// ======================================================

function authenticateToken(
    req,
    res,
    next
) {

    const authHeader =
        req.headers.authorization;


    const token =
        authHeader &&
        authHeader.startsWith("Bearer ")
            ? authHeader.split(" ")[1]
            : null;


    if (!token) {

        return res.status(401).json({

            success: false,

            message:
                "Access token required"

        });

    }


    jwt.verify(

        token,

        JWT_SECRET,

        (error, user) => {

            if (error) {

                return res.status(403).json({

                    success: false,

                    message:
                        "Invalid or expired token"

                });

            }


            req.user =
                user;


            next();

        }

    );

}


// ======================================================
// ADMIN MIDDLEWARE
// ======================================================

function adminOnly(
    req,
    res,
    next
) {

    if (
        !req.user ||
        req.user.role !== "admin"
    ) {

        return res.status(403).json({

            success: false,

            message:
                "Admin access required"

        });

    }


    next();

}


// ======================================================
// PROFILE - GET
// ======================================================

app.get(
    "/profile",
    authenticateToken,
    async (req, res) => {

        try {

            const user =
                await usersCollection.findOne(

                    {
                        _id:
                            getObjectId(
                                req.user.userId
                            )
                    },

                    {
                        projection: {
                            password: 0
                        }
                    }

                );


            if (!user) {

                return res.status(404).json({

                    success: false,

                    message:
                        "User not found"

                });

            }


            res.json({

                success: true,

                user

            });


        } catch (error) {

            console.log(error);

            res.status(500).json({

                success: false,

                message:
                    "Failed to fetch profile"

            });

        }

    }
);


// ======================================================
// PROFILE - UPDATE
// ======================================================

app.put(
    "/profile",
    authenticateToken,
    async (req, res) => {

        try {

            const {
                name,
                email
            } = req.body;


            const updates = {

                updatedAt:
                    new Date()

            };


            if (name) {

                updates.name =
                    name.trim();

            }


            if (email) {

                updates.email =
                    email
                        .trim()
                        .toLowerCase();

            }


            if (updates.email) {

                const existing =
                    await usersCollection.findOne({

                        email:
                            updates.email,

                        _id: {
                            $ne:
                                getObjectId(
                                    req.user.userId
                                )
                        }

                    });


                if (existing) {

                    return res.status(400).json({

                        success: false,

                        message:
                            "Email already in use"

                    });

                }

            }


            await usersCollection.updateOne(

                {
                    _id:
                        getObjectId(
                            req.user.userId
                        )
                },

                {
                    $set:
                        updates
                }

            );


            await createActivityLog({

                userId:
                    req.user.userId,

                action:
                    "UPDATE_PROFILE",

                entity:
                    "USER",

                entityId:
                    req.user.userId

            });


            res.json({

                success: true,

                message:
                    "Profile updated successfully"

            });


        } catch (error) {

            console.log(error);

            res.status(500).json({

                success: false,

                message:
                    "Failed to update profile"

            });

        }

    }
);


// ======================================================
// CHANGE PASSWORD
// ======================================================

app.put(
    "/change-password",
    authenticateToken,
    async (req, res) => {

        try {

            const {
                currentPassword,
                newPassword
            } = req.body;


            if (
                !currentPassword ||
                !newPassword
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Current and new password are required"

                });

            }


            if (newPassword.length < 6) {

                return res.status(400).json({

                    success: false,

                    message:
                        "New password must contain at least 6 characters"

                });

            }


            const user =
                await usersCollection.findOne({

                    _id:
                        getObjectId(
                            req.user.userId
                        )

                });


            if (!user) {

                return res.status(404).json({

                    success: false,

                    message:
                        "User not found"

                });

            }


            const valid =
                await bcrypt.compare(

                    currentPassword,

                    user.password

                );


            if (!valid) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Current password is incorrect"

                });

            }


            const hashedPassword =
                await bcrypt.hash(
                    newPassword,
                    10
                );


            await usersCollection.updateOne(

                {
                    _id:
                        getObjectId(
                            req.user.userId
                        )
                },

                {
                    $set: {

                        password:
                            hashedPassword,

                        updatedAt:
                            new Date()

                    }

                }

            );


            await createActivityLog({

                userId:
                    req.user.userId,

                action:
                    "CHANGE_PASSWORD",

                entity:
                    "USER",

                entityId:
                    req.user.userId

            });


            res.json({

                success: true,

                message:
                    "Password changed successfully"

            });


        } catch (error) {

            console.log(error);

            res.status(500).json({

                success: false,

                message:
                    "Failed to change password"

            });

        }

    }
);


// ======================================================
// FORGOT PASSWORD
// ======================================================

app.post(
    "/forgot-password",
    async (req, res) => {

        try {

            const {
                email
            } = req.body;


            if (!email) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Email is required"

                });

            }


            const normalizedEmail =
                email.trim().toLowerCase();


            const user =
                await usersCollection.findOne({

                    email:
                        normalizedEmail

                });


            /*
             * Do not expose whether email exists
             */

            if (!user) {

                return res.json({

                    success: true,

                    message:
                        "If the email exists, a reset link will be generated"

                });

            }


            const resetToken =
                crypto
                    .randomBytes(32)
                    .toString("hex");


            const resetTokenHash =
                crypto
                    .createHash("sha256")
                    .update(resetToken)
                    .digest("hex");


            const resetExpires =
                new Date(
                    Date.now() +
                    15 * 60 * 1000
                );


            await usersCollection.updateOne(

                {
                    _id:
                        user._id
                },

                {
                    $set: {

                        resetToken:
                            resetTokenHash,

                        resetTokenExpires:
                            resetExpires,

                        updatedAt:
                            new Date()

                    }

                }

            );


            const response = {

                success: true,

                message:
                    "Password reset token generated"

            };


            /*
             * For development/testing only.
             * Do not return reset token in production.
             */

            if (
                process.env.NODE_ENV !==
                "production"
            ) {

                response.resetToken =
                    resetToken;

            }


            res.json(response);


        } catch (error) {

            console.log(error);

            res.status(500).json({

                success: false,

                message:
                    "Failed to process forgot password"

            });

        }

    }
);


// ======================================================
// RESET PASSWORD
// ======================================================

app.post(
    "/reset-password",
    async (req, res) => {

        try {

            const {
                token,
                newPassword
            } = req.body;


            if (!token || !newPassword) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Token and new password are required"

                });

            }


            if (newPassword.length < 6) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Password must contain at least 6 characters"

                });

            }


            const tokenHash =
                crypto
                    .createHash("sha256")
                    .update(token)
                    .digest("hex");


            const user =
                await usersCollection.findOne({

                    resetToken:
                        tokenHash,

                    resetTokenExpires: {
                        $gt:
                            new Date()
                    }

                });


            if (!user) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid or expired reset token"

                });

            }


            const hashedPassword =
                await bcrypt.hash(
                    newPassword,
                    10
                );


            await usersCollection.updateOne(

                {
                    _id:
                        user._id
                },

                {
                    $set: {

                        password:
                            hashedPassword,

                        updatedAt:
                            new Date()

                    },

                    $unset: {

                        resetToken: "",

                        resetTokenExpires: ""

                    }

                }

            );


            await createActivityLog({

                userId:
                    user._id.toString(),

                action:
                    "RESET_PASSWORD",

                entity:
                    "USER",

                entityId:
                    user._id.toString()

            });


            res.json({

                success: true,

                message:
                    "Password reset successfully"

            });


        } catch (error) {

            console.log(error);

            res.status(500).json({

                success: false,

                message:
                    "Failed to reset password"

            });

        }

    }
);


// ======================================================
// ADD PUBLICATION
// ======================================================

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


            if (
                !paperTitle ||
                !publicationType
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Paper title and publication type are required"

                });

            }


            const publication = {

                facultyId:
                    req.user.userId,

                paperTitle:
                    paperTitle.trim(),

                publicationType:
                    publicationType.trim(),

                journalConference:
                    journalConference || "",

                publicationYear:
                    publicationYear
                        ? Number(publicationYear)
                        : null,

                DOI:
                    DOI || "",

                verificationStatus:
                    "Pending",

                rejectionReason:
                    null,

                createdAt:
                    new Date(),

                updatedAt:
                    new Date()

            };


            const result =
                await publicationsCollection.insertOne(
                    publication
                );


            await createActivityLog({

                userId:
                    req.user.userId,

                action:
                    "ADD_PUBLICATION",

                entity:
                    "PUBLICATION",

                entityId:
                    result.insertedId.toString(),

                details: {

                    paperTitle:
                        publication.paperTitle

                }

            });


            /*
             * Notify all admins
             */

            const admins =
                await usersCollection
                    .find({
                        role: "admin"
                    })
                    .toArray();


            for (const admin of admins) {

                await createNotification({

                    userId:
                        admin._id.toString(),

                    title:
                        "New Publication",

                    message:
                        `${publication.paperTitle} requires verification.`,

                    type:
                        "publication",

                    publicationId:
                        result.insertedId.toString()

                });

            }


            res.status(201).json({

                success: true,

                message:
                    "Publication added successfully",

                publicationId:
                    result.insertedId

            });


        } catch (error) {

            console.log(error);

            res.status(500).json({

                success: false,

                message:
                    "Failed to add publication"

            });

        }

    }
);


// ======================================================
// GET PUBLICATIONS - PAGINATED
// ======================================================

app.get(
    "/publications",
    authenticateToken,
    async (req, res) => {

        try {

            const page =
                safePage(
                    req.query.page
                );


            const limit =
                safeLimit(
                    req.query.limit
                );


            const skip =
                (page - 1) * limit;


            const sortField =
                getSafeSortField(
                    req.query.sortBy
                );


            const sortDirection =
                getSortDirection(
                    req.query.order
                );


            const filter = {};


            /*
             * Faculty sees only own publications.
             */

            if (
                req.user.role !==
                "admin"
            ) {

                filter.facultyId =
                    req.user.userId;

            }


            /*
             * Admin can optionally filter by faculty.
             */

            if (
                req.user.role === "admin" &&
                req.query.facultyId
            ) {

                filter.facultyId =
                    req.query.facultyId;

            }


            if (
                req.query.status
            ) {

                filter.verificationStatus =
                    req.query.status;

            }


            if (
                req.query.type
            ) {

                filter.publicationType =
                    req.query.type;

            }


            if (
                req.query.year
            ) {

                filter.publicationYear =
                    Number(
                        req.query.year
                    );

            }


            if (
                req.query.DOI
            ) {

                filter.DOI = {

                    $regex:
                        escapeRegex(
                            req.query.DOI
                        ),

                    $options:
                        "i"

                };

            }


            if (
                req.query.search
            ) {

                filter.$or = [

                    {
                        paperTitle: {

                            $regex:
                                escapeRegex(
                                    req.query.search
                                ),

                            $options:
                                "i"

                        }

                    },

                    {
                        journalConference: {

                            $regex:
                                escapeRegex(
                                    req.query.search
                                ),

                            $options:
                                "i"

                        }

                    },

                    {
                        DOI: {

                            $regex:
                                escapeRegex(
                                    req.query.search
                                ),

                            $options:
                                "i"

                        }

                    }

                ];

            }


            const total =
                await publicationsCollection
                    .countDocuments(filter);


            const publications =
                await publicationsCollection
                    .find(filter)
                    .sort({
                        [sortField]:
                            sortDirection
                    })
                    .skip(skip)
                    .limit(limit)
                    .toArray();


            res.json({

                success: true,

                data:
                    publications,

                pagination: {

                    page,

                    limit,

                    total,

                    totalPages:
                        Math.ceil(
                            total / limit
                        )

                }

            });


        } catch (error) {

            console.log(error);

            res.status(500).json({

                success: false,

                message:
                    "Failed to fetch publications"

            });

        }

    }
);


// ======================================================
// SEARCH PUBLICATIONS
// ======================================================

app.get(
    "/publications/search",
    authenticateToken,
    async (req, res) => {

        try {

            const {

                title,

                DOI,

                year,

                type,

                status,

                facultyId

            } = req.query;


            const filter = {};


            if (
                req.user.role !==
                "admin"
            ) {

                filter.facultyId =
                    req.user.userId;

            }


            if (
                req.user.role === "admin" &&
                facultyId
            ) {

                filter.facultyId =
                    facultyId;

            }


            if (title) {

                filter.paperTitle = {

                    $regex:
                        escapeRegex(title),

                    $options:
                        "i"

                };

            }


            if (DOI) {

                filter.DOI = {

                    $regex:
                        escapeRegex(DOI),

                    $options:
                        "i"

                };

            }


            if (year) {

                filter.publicationYear =
                    Number(year);

            }


            if (type) {

                filter.publicationType =
                    type;

            }


            if (status) {

                filter.verificationStatus =
                    status;

            }


            const publications =
                await publicationsCollection
                    .find(filter)
                    .sort({
                        createdAt: -1
                    })
                    .toArray();


            res.json({

                success: true,

                count:
                    publications.length,

                data:
                    publications

            });


        } catch (error) {

            console.log(error);

            res.status(500).json({

                success: false,

                message:
                    "Search failed"

            });

        }

    }
);


// ======================================================
// GET SINGLE PUBLICATION
// ======================================================

app.get(
    "/publications/:id",
    authenticateToken,
    async (req, res) => {

        try {

            const {
                id
            } = req.params;


            if (!isValidObjectId(id)) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid publication ID"

                });

            }


            const publication =
                await publicationsCollection.findOne({

                    _id:
                        getObjectId(id)

                });


            if (!publication) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Publication not found"

                });

            }


            if (
                req.user.role !== "admin" &&
                publication.facultyId !==
                    req.user.userId
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "You can access only your publications"

                });

            }


            res.json({

                success: true,

                data:
                    publication

            });


        } catch (error) {

            console.log(error);

            res.status(500).json({

                success: false,

                message:
                    "Failed to fetch publication"

            });

        }

    }
);


// ======================================================
// UPDATE PUBLICATION
// ======================================================

app.put(
    "/publications/:id",
    authenticateToken,
    async (req, res) => {

        try {

            const {
                id
            } = req.params;


            if (!isValidObjectId(id)) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid publication ID"

                });

            }


            const publication =
                await publicationsCollection.findOne({

                    _id:
                        getObjectId(id)

                });


            if (!publication) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Publication not found"

                });

            }


            if (
                req.user.role !== "admin" &&
                publication.facultyId !==
                    req.user.userId
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "You can update only your publications"

                });

            }


            const {

                paperTitle,

                publicationType,

                journalConference,

                publicationYear,

                DOI

            } = req.body;


            const updates = {

                updatedAt:
                    new Date()

            };


            if (paperTitle !== undefined) {

                updates.paperTitle =
                    paperTitle.trim();

            }


            if (
                publicationType !==
                undefined
            ) {

                updates.publicationType =
                    publicationType.trim();

            }


            if (
                journalConference !==
                undefined
            ) {

                updates.journalConference =
                    journalConference;

            }


            if (
                publicationYear !==
                undefined
            ) {

                updates.publicationYear =
                    publicationYear
                        ? Number(publicationYear)
                        : null;

            }


            if (DOI !== undefined) {

                updates.DOI =
                    DOI;

            }


            await publicationsCollection.updateOne(

                {
                    _id:
                        getObjectId(id)
                },

                {
                    $set:
                        updates
                }

            );


            await createActivityLog({

                userId:
                    req.user.userId,

                action:
                    "UPDATE_PUBLICATION",

                entity:
                    "PUBLICATION",

                entityId:
                    id

            });


            res.json({

                success: true,

                message:
                    "Publication updated successfully"

            });


        } catch (error) {

            console.log(error);

            res.status(500).json({

                success: false,

                message:
                    "Failed to update publication"

            });

        }

    }
);


// ======================================================
// DELETE PUBLICATION
// ======================================================

app.delete(
    "/publications/:id",
    authenticateToken,
    async (req, res) => {

        try {

            const {
                id
            } = req.params;


            if (!isValidObjectId(id)) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid publication ID"

                });

            }


            const publication =
                await publicationsCollection.findOne({

                    _id:
                        getObjectId(id)

                });


            if (!publication) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Publication not found"

                });

            }


            if (
                req.user.role !== "admin" &&
                publication.facultyId !==
                    req.user.userId
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "You can delete only your publications"

                });

            }


            await publicationsCollection.deleteOne({

                _id:
                    getObjectId(id)

            });


            await createActivityLog({

                userId:
                    req.user.userId,

                action:
                    "DELETE_PUBLICATION",

                entity:
                    "PUBLICATION",

                entityId:
                    id

            });


            res.json({

                success: true,

                message:
                    "Publication deleted successfully"

            });


        } catch (error) {

            console.log(error);

            res.status(500).json({

                success: false,

                message:
                    "Failed to delete publication"

            });

        }

    }
);


// ======================================================
// VERIFY / REJECT PUBLICATION
// ======================================================

app.put(
    "/publications/:id/verify",
    authenticateToken,
    adminOnly,
    async (req, res) => {

        try {

            const {
                id
            } = req.params;

            const {
                verificationStatus,
                rejectionReason
            } = req.body;


            if (!isValidObjectId(id)) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid publication ID"

                });

            }


            if (
                verificationStatus !==
                    "Verified" &&
                verificationStatus !==
                    "Rejected"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Status must be Verified or Rejected"

                });

            }


            if (
                verificationStatus ===
                    "Rejected" &&
                !rejectionReason
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Rejection reason is required"

                });

            }


            const publication =
                await publicationsCollection.findOne({

                    _id:
                        getObjectId(id)

                });


            if (!publication) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Publication not found"

                });

            }


            const updateData = {

                verificationStatus,

                rejectionReason:
                    verificationStatus ===
                        "Rejected"
                        ? rejectionReason
                        : null,

                updatedAt:
                    new Date()

            };


            await publicationsCollection.updateOne(

                {
                    _id:
                        getObjectId(id)
                },

                {
                    $set:
                        updateData
                }

            );


            await createNotification({

                userId:
                    publication.facultyId,

                title:
                    verificationStatus ===
                        "Verified"
                        ? "Publication Verified"
                        : "Publication Rejected",

                message:
                    verificationStatus ===
                        "Verified"
                        ? `Your publication "${publication.paperTitle}" has been verified.`
                        : `Your publication "${publication.paperTitle}" was rejected. Reason: ${rejectionReason}`,

                type:
                    verificationStatus ===
                        "Verified"
                        ? "success"
                        : "rejection",

                publicationId:
                    id

            });


            await createActivityLog({

                userId:
                    req.user.userId,

                action:
                    verificationStatus ===
                        "Verified"
                        ? "VERIFY_PUBLICATION"
                        : "REJECT_PUBLICATION",

                entity:
                    "PUBLICATION",

                entityId:
                    id,

                details: {

                    rejectionReason:
                        rejectionReason || null

                }

            });


            res.json({

                success: true,

                message:
                    verificationStatus ===
                        "Verified"
                        ? "Publication verified successfully"
                        : "Publication rejected successfully"

            });


        } catch (error) {

            console.log(error);

            res.status(500).json({

                success: false,

                message:
                    "Failed to update publication status"

            });

        }

    }
);


// ======================================================
// RESUBMIT REJECTED PUBLICATION
// ======================================================

app.put(
    "/publications/:id/resubmit",
    authenticateToken,
    async (req, res) => {

        try {

            const {
                id
            } = req.params;


            if (!isValidObjectId(id)) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid publication ID"

                });

            }


            const publication =
                await publicationsCollection.findOne({

                    _id:
                        getObjectId(id)

                });


            if (!publication) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Publication not found"

                });

            }


            if (
                req.user.role !== "admin" &&
                publication.facultyId !==
                    req.user.userId
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "You can resubmit only your publications"

                });

            }


            if (
                publication.verificationStatus !==
                "Rejected"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Only rejected publications can be resubmitted"

                });

            }


            await publicationsCollection.updateOne(

                {
                    _id:
                        getObjectId(id)
                },

                {
                    $set: {

                        verificationStatus:
                            "Pending",

                        rejectionReason:
                            null,

                        updatedAt:
                            new Date()

                    }

                }

            );


            await createActivityLog({

                userId:
                    req.user.userId,

                action:
                    "RESUBMIT_PUBLICATION",

                entity:
                    "PUBLICATION",

                entityId:
                    id

            });


            res.json({

                success: true,

                message:
                    "Publication resubmitted successfully"

            });


        } catch (error) {

            console.log(error);

            res.status(500).json({

                success: false,

                message:
                    "Failed to resubmit publication"

            });

        }

    }
);// ======================================================
// GET NOTIFICATIONS
// ======================================================

app.get(
    "/notifications",
    authenticateToken,
    async (req, res) => {

        try {

            const notifications =
                await notificationsCollection
                    .find({
                        userId:
                            req.user.userId
                    })
                    .sort({
                        createdAt: -1
                    })
                    .toArray();


            const unreadCount =
                await notificationsCollection
                    .countDocuments({

                        userId:
                            req.user.userId,

                        isRead:
                            false

                    });


            res.json({

                success: true,

                unreadCount,

                data:
                    notifications

            });


        } catch (error) {

            console.log(
                "Notifications error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Failed to fetch notifications"

            });

        }

    }
);


// ======================================================
// MARK NOTIFICATION AS READ
// ======================================================

app.put(
    "/notifications/:id/read",
    authenticateToken,
    async (req, res) => {

        try {

            const {
                id
            } = req.params;


            if (!isValidObjectId(id)) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid notification ID"

                });

            }


            const result =
                await notificationsCollection.updateOne(

                    {
                        _id:
                            getObjectId(id),

                        userId:
                            req.user.userId

                    },

                    {
                        $set: {

                            isRead:
                                true,

                            readAt:
                                new Date()

                        }

                    }

                );


            if (
                result.matchedCount === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Notification not found"

                });

            }


            res.json({

                success: true,

                message:
                    "Notification marked as read"

            });


        } catch (error) {

            console.log(error);

            res.status(500).json({

                success: false,

                message:
                    "Failed to update notification"

            });

        }

    }
);


// ======================================================
// MARK ALL NOTIFICATIONS AS READ
// ======================================================

app.put(
    "/notifications/read-all",
    authenticateToken,
    async (req, res) => {

        try {

            await notificationsCollection.updateMany(

                {
                    userId:
                        req.user.userId,

                    isRead:
                        false

                },

                {
                    $set: {

                        isRead:
                            true,

                        readAt:
                            new Date()

                    }

                }

            );


            res.json({

                success: true,

                message:
                    "All notifications marked as read"

            });


        } catch (error) {

            console.log(error);

            res.status(500).json({

                success: false,

                message:
                    "Failed to update notifications"

            });

        }

    }
);


// ======================================================
// ADMIN ANALYTICS
// ======================================================

app.get(
    "/admin/analytics",
    authenticateToken,
    adminOnly,
    async (req, res) => {

        try {

            const totalFaculty =
                await usersCollection.countDocuments({

                    role:
                        "faculty"

                });


            const totalPublications =
                await publicationsCollection.countDocuments();


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


            const totalAdmins =
                await usersCollection
                    .countDocuments({

                        role:
                            "admin"

                    });


            const publicationTypeStats =
                await publicationsCollection
                    .aggregate([

                        {
                            $group: {

                                _id:
                                    "$publicationType",

                                count: {
                                    $sum:
                                        1
                                }

                            }

                        },

                        {
                            $sort: {

                                count:
                                    -1

                            }

                        }

                    ])
                    .toArray();


            const yearStats =
                await publicationsCollection
                    .aggregate([

                        {
                            $group: {

                                _id:
                                    "$publicationYear",

                                count: {
                                    $sum:
                                        1
                                }

                            }

                        },

                        {
                            $sort: {

                                _id:
                                    1

                            }

                        }

                    ])
                    .toArray();


            res.json({

                success: true,

                data: {

                    totalFaculty,

                    totalAdmins,

                    totalPublications,

                    verifiedPublications,

                    pendingPublications,

                    rejectedPublications,

                    publicationTypeStats,

                    yearStats

                }

            });


        } catch (error) {

            console.log(
                "Analytics error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Failed to generate analytics"

            });

        }

    }
);


// ======================================================
// ADMIN REPORT
// ======================================================

app.get(
    "/admin/report",
    authenticateToken,
    adminOnly,
    async (req, res) => {

        try {

            const totalFaculty =
                await usersCollection
                    .countDocuments({

                        role:
                            "faculty"

                    });


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


            const departments =
                await departmentsCollection
                    .find({})
                    .toArray();


            res.json({

                success: true,

                data: {

                    totalFaculty,

                    totalPublications,

                    verifiedPublications,

                    pendingPublications,

                    rejectedPublications,

                    departments

                }

            });


        } catch (error) {

            console.log(error);

            res.status(500).json({

                success: false,

                message:
                    "Failed to generate report"

            });

        }

    }
);


// ======================================================
// CSV EXPORT
// ======================================================

app.get(
    "/admin/publications/export",
    authenticateToken,
    adminOnly,
    async (req, res) => {

        try {

            const publications =
                await publicationsCollection
                    .find({})
                    .sort({
                        createdAt:
                            -1
                    })
                    .toArray();


            let csv =
                "Publication ID,Faculty ID,Paper Title,Publication Type,Journal/Conference,Publication Year,DOI,Verification Status,Rejection Reason,Created At\n";


            for (
                const publication
                of publications
            ) {

                const row = [

                    publication._id,

                    publication.facultyId,

                    publication.paperTitle,

                    publication.publicationType,

                    publication.journalConference,

                    publication.publicationYear,

                    publication.DOI,

                    publication.verificationStatus,

                    publication.rejectionReason || "",

                    publication.createdAt

                ];


                const escapedRow =
                    row.map(value => {

                        const stringValue =
                            String(
                                value ?? ""
                            );

                        return `"${stringValue
                            .replace(/"/g, '""')}"`;

                    });


                csv +=
                    escapedRow.join(",") +
                    "\n";

            }


            res.setHeader(
                "Content-Type",
                "text/csv"
            );


            res.setHeader(
                "Content-Disposition",
                "attachment; filename=publications-report.csv"
            );


            res.send(csv);


        } catch (error) {

            console.log(error);

            res.status(500).json({

                success: false,

                message:
                    "Failed to export publications"

            });

        }

    }
);


// ======================================================
// ACTIVITY LOGS - ADMIN
// ======================================================

app.get(
    "/admin/activity-logs",
    authenticateToken,
    adminOnly,
    async (req, res) => {

        try {

            const page =
                safePage(
                    req.query.page
                );


            const limit =
                safeLimit(
                    req.query.limit
                );


            const skip =
                (page - 1) * limit;


            const total =
                await activityLogsCollection
                    .countDocuments();


            const logs =
                await activityLogsCollection
                    .find({})
                    .sort({
                        createdAt:
                            -1
                    })
                    .skip(skip)
                    .limit(limit)
                    .toArray();


            res.json({

                success: true,

                data:
                    logs,

                pagination: {

                    page,

                    limit,

                    total,

                    totalPages:
                        Math.ceil(
                            total / limit
                        )

                }

            });


        } catch (error) {

            console.log(error);

            res.status(500).json({

                success: false,

                message:
                    "Failed to fetch activity logs"

            });

        }

    }
);


// ======================================================
// DEPARTMENTS - CREATE
// ======================================================

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


            if (!departmentName) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Department name is required"

                });

            }


            const existing =
                await departmentsCollection
                    .findOne({

                        departmentName:
                            departmentName.trim()

                    });


            if (existing) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Department already exists"

                });

            }


            const department = {

                departmentName:
                    departmentName.trim(),

                HODName:
                    HODName || "",

                totalFaculty:
                    totalFaculty
                        ? Number(totalFaculty)
                        : 0,

                createdAt:
                    new Date(),

                updatedAt:
                    new Date()

            };


            const result =
                await departmentsCollection
                    .insertOne(
                        department
                    );


            await createActivityLog({

                userId:
                    req.user.userId,

                action:
                    "CREATE_DEPARTMENT",

                entity:
                    "DEPARTMENT",

                entityId:
                    result.insertedId.toString()

            });


            res.status(201).json({

                success: true,

                message:
                    "Department added successfully",

                departmentId:
                    result.insertedId

            });


        } catch (error) {

            console.log(error);

            res.status(500).json({

                success: false,

                message:
                    "Failed to add department"

            });

        }

    }
);


// ======================================================
// DEPARTMENTS - GET
// ======================================================

app.get(
    "/departments",
    authenticateToken,
    async (req, res) => {

        try {

            const departments =
                await departmentsCollection
                    .find({})
                    .sort({
                        departmentName:
                            1
                    })
                    .toArray();


            res.json({

                success: true,

                data:
                    departments

            });


        } catch (error) {

            console.log(error);

            res.status(500).json({

                success: false,

                message:
                    "Failed to fetch departments"

            });

        }

    }
);


// ======================================================
// DEPARTMENTS - UPDATE
// ======================================================

app.put(
    "/departments/:id",
    authenticateToken,
    adminOnly,
    async (req, res) => {

        try {

            const {
                id
            } = req.params;


            if (!isValidObjectId(id)) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid department ID"

                });

            }


            const {

                departmentName,

                HODName,

                totalFaculty

            } = req.body;


            const updates = {

                updatedAt:
                    new Date()

            };


            if (
                departmentName !==
                undefined
            ) {

                updates.departmentName =
                    departmentName.trim();

            }


            if (
                HODName !==
                undefined
            ) {

                updates.HODName =
                    HODName;

            }


            if (
                totalFaculty !==
                undefined
            ) {

                updates.totalFaculty =
                    Number(totalFaculty);

            }


            const result =
                await departmentsCollection
                    .updateOne(

                        {
                            _id:
                                getObjectId(id)
                        },

                        {
                            $set:
                                updates
                        }

                    );


            if (
                result.matchedCount ===
                0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Department not found"

                });

            }


            await createActivityLog({

                userId:
                    req.user.userId,

                action:
                    "UPDATE_DEPARTMENT",

                entity:
                    "DEPARTMENT",

                entityId:
                    id

            });


            res.json({

                success: true,

                message:
                    "Department updated successfully"

            });


        } catch (error) {

            console.log(error);

            res.status(500).json({

                success: false,

                message:
                    "Failed to update department"

            });

        }

    }
);


// ======================================================
// DEPARTMENTS - DELETE
// ======================================================

app.delete(
    "/departments/:id",
    authenticateToken,
    adminOnly,
    async (req, res) => {

        try {

            const {
                id
            } = req.params;


            if (!isValidObjectId(id)) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid department ID"

                });

            }


            const result =
                await departmentsCollection
                    .deleteOne({

                        _id:
                            getObjectId(id)

                    });


            if (
                result.deletedCount ===
                0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Department not found"

                });

            }


            await createActivityLog({

                userId:
                    req.user.userId,

                action:
                    "DELETE_DEPARTMENT",

                entity:
                    "DEPARTMENT",

                entityId:
                    id

            });


            res.json({

                success: true,

                message:
                    "Department deleted successfully"

            });


        } catch (error) {

            console.log(error);

            res.status(500).json({

                success: false,

                message:
                    "Failed to delete department"

            });

        }

    }
);


// ======================================================
// DEPARTMENT REPORT
// ======================================================

app.get(
    "/departments/:id/report",
    authenticateToken,
    adminOnly,
    async (req, res) => {

        try {

            const {
                id
            } = req.params;


            if (!isValidObjectId(id)) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid department ID"

                });

            }


            const department =
                await departmentsCollection
                    .findOne({

                        _id:
                            getObjectId(id)

                    });


            if (!department) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Department not found"

                });

            }


            /*
             * The current publication model does not
             * store departmentId directly.
             *
             * Therefore this report returns the
             * department information available.
             */

            res.json({

                success: true,

                data: {

                    department,

                    note:
                        "Department-wise publication mapping requires departmentId in the publication model."

                }

            });


        } catch (error) {

            console.log(error);

            res.status(500).json({

                success: false,

                message:
                    "Failed to generate department report"

            });

        }

    }
);


// ======================================================
// HEALTH CHECK
// ======================================================

app.get(
    "/health",
    async (req, res) => {

        try {

            await db.command({
                ping: 1
            });


            res.json({

                success: true,

                server:
                    "running",

                database:
                    "connected"

            });


        } catch (error) {

            res.status(500).json({

                success: false,

                server:
                    "running",

                database:
                    "disconnected"

            });

        }

    }
);


// ======================================================
// 404 HANDLER
// ======================================================

app.use(
    (req, res) => {

        res.status(404).json({

            success: false,

            message:
                "API endpoint not found",

            path:
                req.originalUrl

        });

    }
);


// ======================================================
// GLOBAL ERROR HANDLER
// ======================================================

app.use(
    (error, req, res, next) => {

        console.error(
            "Global error:",
            error
        );


        if (
            res.headersSent
        ) {

            return next(error);

        }


        res.status(500).json({

            success: false,

            message:
                "Internal server error"

        });

    }
);


// ======================================================
// START SERVER
// ======================================================

async function startServer() {

    try {

        await connectDatabase();


        app.listen(
            PORT,
            () => {

                console.log(
                    `Server is running on port ${PORT}`
                );

            }
        );


    } catch (error) {

        console.error(
            "Failed to start server:",
            error
        );

        process.exit(1);

    }

}


startServer();