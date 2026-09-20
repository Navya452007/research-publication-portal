import { useEffect, useState } from "react";
import "./App.css";

const API = "http://localhost:5000";

function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [role, setRole] = useState(localStorage.getItem("role"));

  const [authMode, setAuthMode] = useState("login");
  const [authData, setAuthData] = useState({
    name: "",
    email: "",
    password: "",
    role: "faculty",
  });

  const [activePage, setActivePage] = useState("dashboard");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [publications, setPublications] = useState([]);
  const [report, setReport] = useState(null);

  const [formData, setFormData] = useState({
    paperTitle: "",
    publicationType: "Journal",
    journalConference: "",
    publicationYear: "",
    DOI: "",
  });

  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    if (token) {
      fetchPublications();
      if (role === "admin") {
        fetchReport();
      }
    }
  }, [token, role]);

  // ---------------- AUTH ----------------

  const handleAuth = async (e) => {
    e.preventDefault();

    setMessage("");
    setError("");

    const url =
      authMode === "login"
        ? `${API}/login`
        : `${API}/register`;

    try {
      const body =
        authMode === "login"
          ? {
              email: authData.email,
              password: authData.password,
            }
          : authData;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Something went wrong");
        return;
      }

      if (authMode === "register") {
        setMessage("Registration successful. Please login.");
        setAuthMode("login");

        setAuthData({
          name: "",
          email: authData.email,
          password: "",
          role: "faculty",
        });
      } else {
        localStorage.setItem("token", data.token);
        localStorage.setItem("role", data.role);

        setToken(data.token);
        setRole(data.role);

        setMessage("Login successful");
      }
    } catch (err) {
      setError("Backend server is not running");
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");

    setToken(null);
    setRole(null);
    setPublications([]);
    setReport(null);
  };

  // ---------------- PUBLICATIONS ----------------

  const fetchPublications = async () => {
    try {
      const response = await fetch(`${API}/publications`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setPublications(data);
      }
    } catch (err) {
      console.log(err);
    }
  };

  const fetchReport = async () => {
    try {
      const response = await fetch(`${API}/admin/report`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setReport(data);
      }
    } catch (err) {
      console.log(err);
    }
  };

  const handleFormChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const clearForm = () => {
    setFormData({
      paperTitle: "",
      publicationType: "Journal",
      journalConference: "",
      publicationYear: "",
      DOI: "",
    });

    setEditingId(null);
  };

  const addPublication = async (e) => {
    e.preventDefault();

    setMessage("");
    setError("");

    try {
      const response = await fetch(`${API}/publications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          publicationYear: Number(formData.publicationYear),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Failed to add publication");
        return;
      }

      setMessage("Publication added successfully");

      clearForm();
      fetchPublications();

      setActivePage("publications");
    } catch (err) {
      setError("Something went wrong");
    }
  };

  const startEdit = (publication) => {
    setEditingId(publication._id);

    setFormData({
      paperTitle: publication.paperTitle || "",
      publicationType: publication.publicationType || "Journal",
      journalConference: publication.journalConference || "",
      publicationYear: publication.publicationYear || "",
      DOI: publication.DOI || "",
    });

    setActivePage("edit");
  };

  const updatePublication = async (e) => {
    e.preventDefault();

    setMessage("");
    setError("");

    try {
      const response = await fetch(
        `${API}/publications/${editingId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ...formData,
            publicationYear: Number(formData.publicationYear),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Update failed");
        return;
      }

      setMessage("Publication updated successfully");

      clearForm();
      fetchPublications();

      setActivePage("publications");

      if (role === "admin") {
        fetchReport();
      }
    } catch (err) {
      setError("Something went wrong");
    }
  };

  const deletePublication = async (id) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this publication?"
    );

    if (!confirmDelete) return;

    try {
      const response = await fetch(
        `${API}/publications/${id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Delete failed");
        return;
      }

      setMessage("Publication deleted successfully");

      fetchPublications();

      if (role === "admin") {
        fetchReport();
      }
    } catch (err) {
      setError("Something went wrong");
    }
  };

  const verifyPublication = async (id, status) => {
    try {
      const response = await fetch(
        `${API}/publications/${id}/verify`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            verificationStatus: status,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Verification failed");
        return;
      }

      setMessage(`Publication ${status.toLowerCase()} successfully`);

      fetchPublications();
      fetchReport();
    } catch (err) {
      setError("Something went wrong");
    }
  };

  // ---------------- LOGIN / REGISTER PAGE ----------------

  if (!token) {
    return (
      <div className="auth-page">

        <div className="auth-showcase">
          <div className="showcase-overlay"></div>

          <div className="showcase-content">

            <div className="auth-brand">
              <div className="brand-logo">
                RH
              </div>

              <div>
                <h2>ResearchHub</h2>
                <span>Publication Management Portal</span>
              </div>
            </div>

            <div className="showcase-main">

              <div className="eyebrow">
                ACADEMIC RESEARCH PLATFORM
              </div>

              <h1>
                Manage your research.
                <br />
                Grow your academic profile.
              </h1>

              <p className="showcase-description">
                A centralized platform for faculty members to
                manage research publications, track publication
                history and simplify academic verification.
              </p>

              <div className="showcase-features">

                <Feature
                  icon="01"
                  title="Publication Management"
                  text="Add, update and organize your research publications."
                />

                <Feature
                  icon="02"
                  title="Secure Authentication"
                  text="Protected login with role-based access."
                />

                <Feature
                  icon="03"
                  title="Admin Verification"
                  text="Administrators can review and verify publications."
                />

                <Feature
                  icon="04"
                  title="Academic Reports"
                  text="Get a clear overview of faculty and publications."
                />

              </div>
            </div>

            <div className="showcase-footer">
              © 2026 ResearchHub · Research Publication Management Portal
            </div>

          </div>
        </div>

        <div className="auth-form-section">

          <div className="auth-form-container">

            <div className="mobile-brand">
              <div className="brand-logo">RH</div>
              <div>
                <h2>ResearchHub</h2>
              </div>
            </div>

            <div className="auth-heading">

              <div className="form-eyebrow">
                {authMode === "login"
                  ? "WELCOME BACK"
                  : "GET STARTED"}
              </div>

              <h2>
                {authMode === "login"
                  ? "Welcome back"
                  : "Create your account"}
              </h2>

              <p>
                {authMode === "login"
                  ? "Sign in to access your research dashboard."
                  : "Register as a faculty member to manage your publications."}
              </p>

            </div>

            {message && (
              <div className="auth-alert success">
                ✓ {message}
              </div>
            )}

            {error && (
              <div className="auth-alert error">
                ⚠ {error}
              </div>
            )}

            <form
              className="auth-form"
              onSubmit={handleAuth}
            >

              {authMode === "register" && (
                <div className="form-field">

                  <label>Full Name</label>

                  <div className="input-wrapper">

                    <span className="input-icon">
                      👤
                    </span>

                    <input
                      type="text"
                      placeholder="Enter your full name"
                      value={authData.name}
                      onChange={(e) =>
                        setAuthData({
                          ...authData,
                          name: e.target.value,
                        })
                      }
                      required
                    />

                  </div>
                </div>
              )}

              <div className="form-field">

                <label>Email Address</label>

                <div className="input-wrapper">

                  <span className="input-icon">
                    ✉
                  </span>

                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={authData.email}
                    onChange={(e) =>
                      setAuthData({
                        ...authData,
                        email: e.target.value,
                      })
                    }
                    required
                  />

                </div>
              </div>

              <div className="form-field">

                <label>Password</label>

                <div className="input-wrapper">

                  <span className="input-icon">
                    🔒
                  </span>

                  <input
                    type="password"
                    placeholder="Enter your password"
                    value={authData.password}
                    onChange={(e) =>
                      setAuthData({
                        ...authData,
                        password: e.target.value,
                      })
                    }
                    required
                  />

                </div>
              </div>

              {authMode === "register" && (
                <div className="form-field">

                  <label>Account Type</label>

                  <div className="input-wrapper select-wrapper">

                    <span className="input-icon">
                      ◉
                    </span>

                    <select
                      value={authData.role}
                      onChange={(e) =>
                        setAuthData({
                          ...authData,
                          role: e.target.value,
                        })
                      }
                    >
                      <option value="faculty">
                        Faculty
                      </option>

                      <option value="admin">
                        Admin
                      </option>

                    </select>

                  </div>
                </div>
              )}

              <button
                type="submit"
                className="auth-submit"
              >
                {authMode === "login"
                  ? "Sign In"
                  : "Create Account"}

                <span className="button-arrow">
                  →
                </span>
              </button>

            </form>

            <div className="auth-divider">
              <span>OR</span>
            </div>

            <div className="auth-switch">

              <p>
                {authMode === "login"
                  ? "Don't have an account?"
                  : "Already have an account?"}
              </p>

              <button
                onClick={() => {
                  setAuthMode(
                    authMode === "login"
                      ? "register"
                      : "login"
                  );

                  setMessage("");
                  setError("");
                }}
              >
                {authMode === "login"
                  ? "Create Account"
                  : "Sign In"}
              </button>

            </div>

            <div className="security-note">
              <span>🔐</span>

              <p>
                Your account is protected with secure
                authentication and encrypted passwords.
              </p>
            </div>

          </div>
        </div>

      </div>
    );
  }

  // ---------------- MAIN APP ----------------

  return (
    <div className="app-layout">

      <aside className="sidebar">

        <div className="sidebar-brand">

          <div className="brand-logo">
            RH
          </div>

          <div>
            <h2>ResearchHub</h2>
            <span>Academic Portal</span>
          </div>

        </div>

        <div className="sidebar-section-title">
          MAIN MENU
        </div>

        <nav className="sidebar-nav">

          <button
            className={
              activePage === "dashboard"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() =>
              setActivePage("dashboard")
            }
          >
            <span>▦</span>
            Dashboard
          </button>

          <button
            className={
              activePage === "publications"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() =>
              setActivePage("publications")
            }
          >
            <span>▤</span>
            Publications
          </button>

          {role === "faculty" && (
            <>
              <button
                className={
                  activePage === "add"
                    ? "nav-item active"
                    : "nav-item"
                }
                onClick={() =>
                  setActivePage("add")
                }
              >
                <span>＋</span>
                Add Publication
              </button>

              <button
                className={
                  activePage === "history"
                    ? "nav-item active"
                    : "nav-item"
                }
                onClick={() =>
                  setActivePage("history")
                }
              >
                <span>◷</span>
                Publication History
              </button>
            </>
          )}

          {role === "admin" && (
            <>
              <button
                className={
                  activePage === "reports"
                    ? "nav-item active"
                    : "nav-item"
                }
                onClick={() =>
                  setActivePage("reports")
                }
              >
                <span>▥</span>
                Reports
              </button>
            </>
          )}

        </nav>

        <div className="sidebar-bottom">

          <div className="user-mini">

            <div className="avatar">
              {role === "admin" ? "A" : "F"}
            </div>

            <div>
              <strong>
                {role === "admin"
                  ? "Administrator"
                  : "Faculty Member"}
              </strong>

              <span>
                {role === "admin"
                  ? "Admin Account"
                  : "Faculty Account"}
              </span>
            </div>

          </div>

          <button
            className="logout-btn"
            onClick={logout}
          >
            ⇥
            <span>Logout</span>
          </button>

        </div>

      </aside>

      <main className="main-content">

        <header className="topbar">

          <div>
            <h1>
              {activePage === "dashboard" &&
                "Dashboard"}

              {activePage === "publications" &&
                "Publications"}

              {activePage === "add" &&
                "Add Publication"}

              {activePage === "edit" &&
                "Edit Publication"}

              {activePage === "history" &&
                "Publication History"}

              {activePage === "reports" &&
                "Reports"}
            </h1>

            <p>
              Manage your academic research activities
            </p>
          </div>

          <div className="topbar-user">

            <div className="topbar-avatar">
              {role === "admin" ? "A" : "F"}
            </div>

            <div>
              <strong>
                {role === "admin"
                  ? "Administrator"
                  : "Faculty"}
              </strong>

              <span>
                {role === "admin"
                  ? "Admin"
                  : "Faculty"}
              </span>
            </div>

          </div>

        </header>

        {message && (
          <div className="page-message success">
            ✓ {message}
          </div>
        )}

        {error && (
          <div className="page-message error">
            ⚠ {error}
          </div>
        )}

        <div className="page-container">

          {role === "faculty" ? (
            <FacultyDashboard
              activePage={activePage}
              setActivePage={setActivePage}
              publications={publications}
              formData={formData}
              handleFormChange={handleFormChange}
              addPublication={addPublication}
              updatePublication={updatePublication}
              editingId={editingId}
              startEdit={startEdit}
              deletePublication={deletePublication}
              clearForm={clearForm}
            />
          ) : (
            <AdminDashboard
              activePage={activePage}
              setActivePage={setActivePage}
              publications={publications}
              report={report}
              startEdit={startEdit}
              deletePublication={deletePublication}
              verifyPublication={verifyPublication}
              formData={formData}
              handleFormChange={handleFormChange}
              updatePublication={updatePublication}
              clearForm={clearForm}
            />
          )}

        </div>

      </main>

    </div>
  );
}

// ======================================================
// FACULTY DASHBOARD
// ======================================================

function FacultyDashboard({
  activePage,
  setActivePage,
  publications,
  formData,
  handleFormChange,
  addPublication,
  updatePublication,
  editingId,
  startEdit,
  deletePublication,
  clearForm,
}) {
  if (activePage === "add") {
    return (
      <PublicationForm
        title="Add New Publication"
        description="Enter the details of your research publication."
        formData={formData}
        handleFormChange={handleFormChange}
        onSubmit={addPublication}
        clearForm={clearForm}
        buttonText="Add Publication"
      />
    );
  }

  if (activePage === "edit") {
    return (
      <PublicationForm
        title="Edit Publication"
        description="Update the details of your research publication."
        formData={formData}
        handleFormChange={handleFormChange}
        onSubmit={updatePublication}
        clearForm={clearForm}
        buttonText="Update Publication"
      />
    );
  }

  if (
    activePage === "publications" ||
    activePage === "history"
  ) {
    return (
      <PublicationTable
        publications={publications}
        role="faculty"
        onEdit={startEdit}
        onDelete={deletePublication}
      />
    );
  }

  const total = publications.length;

  const verified = publications.filter(
    (p) => p.verificationStatus === "Verified"
  ).length;

  const pending = publications.filter(
    (p) => p.verificationStatus === "Pending"
  ).length;

  const rejected = publications.filter(
    (p) => p.verificationStatus === "Rejected"
  ).length;

  return (
    <>

      <div className="welcome-banner">

        <div>
          <span className="banner-label">
            FACULTY PORTAL
          </span>

          <h2>
            Welcome to your research dashboard
          </h2>

          <p>
            Keep your publications organized and
            track their verification status.
          </p>
        </div>

        <button
          onClick={() =>
            setActivePage("add")
          }
        >
          + Add Publication
        </button>

      </div>

      <div className="stats-grid">

        <StatCard
          icon="▤"
          title="Total Publications"
          value={total}
        />

        <StatCard
          icon="✓"
          title="Verified"
          value={verified}
        />

        <StatCard
          icon="◷"
          title="Pending"
          value={pending}
        />

        <StatCard
          icon="!"
          title="Rejected"
          value={rejected}
        />

      </div>

      <div className="section-header">

        <div>
          <h2>Recent Publications</h2>
          <p>
            Your latest research publications
          </p>
        </div>

        <button
          className="text-button"
          onClick={() =>
            setActivePage("publications")
          }
        >
          View All →
        </button>

      </div>

      <PublicationTable
        publications={publications.slice(0, 5)}
        role="faculty"
        onEdit={startEdit}
        onDelete={deletePublication}
      />

    </>
  );
}

// ======================================================
// ADMIN DASHBOARD
// ======================================================

function AdminDashboard({
  activePage,
  setActivePage,
  publications,
  report,
  startEdit,
  deletePublication,
  verifyPublication,
  formData,
  handleFormChange,
  updatePublication,
  clearForm,
}) {
  if (activePage === "edit") {
    return (
      <PublicationForm
        title="Edit Publication"
        description="Update publication information and verification status."
        formData={formData}
        handleFormChange={handleFormChange}
        onSubmit={updatePublication}
        clearForm={clearForm}
        buttonText="Update Publication"
      />
    );
  }

  if (activePage === "publications") {
    return (
      <PublicationTable
        publications={publications}
        role="admin"
        onEdit={startEdit}
        onDelete={deletePublication}
        onVerify={verifyPublication}
      />
    );
  }

  if (activePage === "reports") {
    return (
      <>

        <div className="section-header">
          <div>
            <h2>Publication Reports</h2>
            <p>
              Overview of research publication activity.
            </p>
          </div>
        </div>

        {report && (
          <div className="stats-grid">

            <StatCard
              icon="👥"
              title="Total Faculty"
              value={report.totalFaculty}
            />

            <StatCard
              icon="▤"
              title="Total Publications"
              value={report.totalPublications}
            />

            <StatCard
              icon="✓"
              title="Verified"
              value={report.verifiedPublications}
            />

            <StatCard
              icon="◷"
              title="Pending"
              value={report.pendingPublications}
            />

            <StatCard
              icon="!"
              title="Rejected"
              value={report.rejectedPublications}
            />

          </div>
        )}

        <div className="report-card">

          <div className="report-card-header">
            <div>
              <span className="report-icon">
                ▥
              </span>

              <div>
                <h3>Research Publication Summary</h3>
                <p>
                  Current publication verification overview
                </p>
              </div>
            </div>
          </div>

          {report && (
            <div className="report-list">

              <ReportRow
                label="Total Faculty"
                value={report.totalFaculty}
              />

              <ReportRow
                label="Total Publications"
                value={report.totalPublications}
              />

              <ReportRow
                label="Verified Publications"
                value={report.verifiedPublications}
              />

              <ReportRow
                label="Pending Publications"
                value={report.pendingPublications}
              />

              <ReportRow
                label="Rejected Publications"
                value={report.rejectedPublications}
              />

            </div>
          )}

        </div>

      </>
    );
  }

  return (
    <>

      <div className="welcome-banner admin-banner">

        <div>

          <span className="banner-label">
            ADMINISTRATOR PORTAL
          </span>

          <h2>
            Research Publication Administration
          </h2>

          <p>
            Review, verify and manage faculty
            research publications.
          </p>

        </div>

        <button
          onClick={() =>
            setActivePage("publications")
          }
        >
          View Publications →
        </button>

      </div>

      {report && (
        <div className="stats-grid">

          <StatCard
            icon="👥"
            title="Total Faculty"
            value={report.totalFaculty}
          />

          <StatCard
            icon="▤"
            title="Publications"
            value={report.totalPublications}
          />

          <StatCard
            icon="✓"
            title="Verified"
            value={report.verifiedPublications}
          />

          <StatCard
            icon="◷"
            title="Pending"
            value={report.pendingPublications}
          />

        </div>
      )}

      <div className="section-header">

        <div>
          <h2>Recent Publications</h2>
          <p>
            Review the latest faculty submissions.
          </p>
        </div>

        <button
          className="text-button"
          onClick={() =>
            setActivePage("publications")
          }
        >
          View All →
        </button>

      </div>

      <PublicationTable
        publications={publications.slice(0, 5)}
        role="admin"
        onEdit={startEdit}
        onDelete={deletePublication}
        onVerify={verifyPublication}
      />

    </>
  );
}

// ======================================================
// PUBLICATION FORM
// ======================================================

function PublicationForm({
  title,
  description,
  formData,
  handleFormChange,
  onSubmit,
  clearForm,
  buttonText,
}) {
  return (
    <div className="form-page">

      <div className="section-header">

        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>

      </div>

      <form
        className="publication-form"
        onSubmit={onSubmit}
      >

        <div className="form-grid">

          <div className="form-field full-width">

            <label>
              Paper Title
            </label>

            <input
              type="text"
              name="paperTitle"
              placeholder="Enter research paper title"
              value={formData.paperTitle}
              onChange={handleFormChange}
              required
            />

          </div>

          <div className="form-field">

            <label>
              Publication Type
            </label>

            <select
              name="publicationType"
              value={formData.publicationType}
              onChange={handleFormChange}
            >
              <option value="Journal">
                Journal
              </option>

              <option value="Conference">
                Conference
              </option>

              <option value="Book">
                Book
              </option>

              <option value="Book Chapter">
                Book Chapter
              </option>
            </select>

          </div>

          <div className="form-field">

            <label>
              Publication Year
            </label>

            <input
              type="number"
              name="publicationYear"
              placeholder="2026"
              value={formData.publicationYear}
              onChange={handleFormChange}
              required
            />

          </div>

          <div className="form-field full-width">

            <label>
              Journal / Conference
            </label>

            <input
              type="text"
              name="journalConference"
              placeholder="Enter journal or conference name"
              value={formData.journalConference}
              onChange={handleFormChange}
              required
            />

          </div>

          <div className="form-field full-width">

            <label>
              DOI
            </label>

            <input
              type="text"
              name="DOI"
              placeholder="10.xxxx/xxxxx"
              value={formData.DOI}
              onChange={handleFormChange}
            />

          </div>

        </div>

        <div className="form-actions">

          <button
            type="button"
            className="secondary-btn"
            onClick={clearForm}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="primary-btn"
          >
            {buttonText}
          </button>

        </div>

      </form>

    </div>
  );
}

// ======================================================
// PUBLICATION TABLE
// ======================================================

function PublicationTable({
  publications,
  role,
  onEdit,
  onDelete,
  onVerify,
}) {
  return (
    <div className="table-card">

      <div className="table-wrapper">

        <table>

          <thead>

            <tr>
              <th>Paper Title</th>
              <th>Type</th>
              <th>Journal / Conference</th>
              <th>Year</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>

          </thead>

          <tbody>

            {publications.length === 0 ? (
              <tr>

                <td
                  colSpan="6"
                  className="empty-cell"
                >
                  <EmptyState />
                </td>

              </tr>
            ) : (
              publications.map((publication) => (

                <tr key={publication._id}>

                  <td>

                    <div className="paper-title">
                      {publication.paperTitle}
                    </div>

                    {publication.DOI && (
                      <div className="paper-doi">
                        DOI: {publication.DOI}
                      </div>
                    )}

                  </td>

                  <td>
                    {publication.publicationType}
                  </td>

                  <td>
                    {publication.journalConference}
                  </td>

                  <td>
                    {publication.publicationYear}
                  </td>

                  <td>
                    <StatusBadge
                      status={
                        publication.verificationStatus
                      }
                    />
                  </td>

                  <td>

                    <div className="action-buttons">

                      {role === "admin" &&
                        publication.verificationStatus ===
                          "Pending" && (
                          <>
                            <button
                              className="verify-btn"
                              onClick={() =>
                                onVerify(
                                  publication._id,
                                  "Verified"
                                )
                              }
                            >
                              Verify
                            </button>

                            <button
                              className="reject-btn"
                              onClick={() =>
                                onVerify(
                                  publication._id,
                                  "Rejected"
                                )
                              }
                            >
                              Reject
                            </button>
                          </>
                        )}

                      <button
                        className="edit-btn"
                        onClick={() =>
                          onEdit(publication)
                        }
                      >
                        Edit
                      </button>

                      <button
                        className="delete-btn"
                        onClick={() =>
                          onDelete(publication._id)
                        }
                      >
                        Delete
                      </button>

                    </div>

                  </td>

                </tr>

              ))
            )}

          </tbody>

        </table>

      </div>

    </div>
  );
}

// ======================================================
// COMPONENTS
// ======================================================

function Feature({ icon, title, text }) {
  return (
    <div className="showcase-feature">

      <div className="feature-icon">
        {icon}
      </div>

      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>

    </div>
  );
}

function StatCard({ icon, title, value }) {
  return (
    <div className="stat-card">

      <div className="stat-icon">
        {icon}
      </div>

      <div>
        <p>{title}</p>
        <h3>{value}</h3>
      </div>

    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span
      className={`status-badge ${status?.toLowerCase()}`}
    >
      {status}
    </span>
  );
}

function ReportRow({ label, value }) {
  return (
    <div className="report-row">

      <span>{label}</span>

      <strong>{value}</strong>

    </div>
  );
}

function EmptyState() {
  return (
    <div className="empty-state">

      <div className="empty-icon">
        ▤
      </div>

      <h3>
        No publications found
      </h3>

      <p>
        Publications added to your account
        will appear here.
      </p>

    </div>
  );
}

export default App;