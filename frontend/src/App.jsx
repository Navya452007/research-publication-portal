import { useEffect, useState } from "react";
import "./App.css";

const API = "http://localhost:5000";


// =====================================================
// MAIN APP
// =====================================================

function App() {

  const [loggedIn, setLoggedIn] = useState(
    !!localStorage.getItem("token")
  );

  const [isRegister, setIsRegister] = useState(false);

  // Authentication
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("faculty");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Dashboard
  const [activePage, setActivePage] = useState("dashboard");

  // Publications
  const [publications, setPublications] = useState([]);

  // Report
  const [report, setReport] = useState(null);

  // Notifications
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Publication form
  const [paperTitle, setPaperTitle] = useState("");
  const [publicationType, setPublicationType] =
    useState("Journal");

  const [journalConference, setJournalConference] =
    useState("");

  const [publicationYear, setPublicationYear] =
    useState("");

  const [DOI, setDOI] = useState("");

  const [editingId, setEditingId] = useState(null);

  // Search / filters
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [yearFilter, setYearFilter] = useState("All");

  const token = localStorage.getItem("token");
  const currentRole = localStorage.getItem("role");


  // ===================================================
  // LOAD DATA
  // ===================================================

  useEffect(() => {

    if (!loggedIn) return;

    fetchPublications();
    fetchNotifications();

    if (currentRole === "admin") {
      fetchReport();
    }

  }, [loggedIn, currentRole]);


  // ===================================================
  // AUTHENTICATION
  // ===================================================

  const handleAuth = async (e) => {

    e.preventDefault();

    setMessage("");
    setLoading(true);

    const url = isRegister
      ? `${API}/register`
      : `${API}/login`;

    const body = isRegister
      ? {
          name: name.trim(),
          email: email.trim(),
          password,
          role
        }
      : {
          email: email.trim(),
          password
        };

    try {

      const response = await fetch(url, {

        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify(body)

      });

      const data = await response.json();

      if (!response.ok) {

        setMessage(
          data.message ||
          "Something went wrong"
        );

        return;
      }


      // Registration
      if (isRegister) {

        setMessage(
          "Registration successful. Please login."
        );

        setIsRegister(false);

        setPassword("");

        setName("");

        setRole("faculty");

        return;
      }


      // Login
      localStorage.setItem(
        "token",
        data.token
      );

      localStorage.setItem(
        "role",
        data.role
      );

      setLoggedIn(true);

      setActivePage("dashboard");

      setMessage("");

    } catch (error) {

      console.error(error);

      setMessage(
        "Server connection failed"
      );

    } finally {

      setLoading(false);

    }

  };


  // ===================================================
  // FETCH PUBLICATIONS
  // ===================================================

  const fetchPublications = async () => {

    const currentToken =
      localStorage.getItem("token");

    if (!currentToken) return;

    try {

      const response = await fetch(
        `${API}/publications`,
        {
          headers: {
            Authorization:
              `Bearer ${currentToken}`
          }
        }
      );

      const result =
        await response.json();

      if (!response.ok) {

        console.log(result.message);

        return;
      }

      /*
       * Backend returns:
       * {
       *   success: true,
       *   data: [...]
       * }
       */

      setPublications(
        Array.isArray(result.data)
          ? result.data
          : []
      );

    } catch (error) {

      console.error(
        "Fetch publications error:",
        error
      );

    }

  };


  // ===================================================
  // ADD PUBLICATION
  // ===================================================

  const addPublication = async (e) => {

    e.preventDefault();

    setMessage("");
    setLoading(true);

    try {

      const response = await fetch(
        `${API}/publications`,
        {

          method: "POST",

          headers: {

            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${token}`

          },

          body: JSON.stringify({

            paperTitle:
              paperTitle.trim(),

            publicationType,

            journalConference:
              journalConference.trim(),

            publicationYear:
              Number(publicationYear),

            DOI:
              DOI.trim()

          })

        }
      );

      const data =
        await response.json();

      if (!response.ok) {

        setMessage(
          data.message ||
          "Failed to add publication"
        );

        return;
      }

      setMessage(
        "Publication added successfully."
      );

      clearForm();

      await fetchPublications();

      await fetchNotifications();

      setActivePage("publications");

    } catch (error) {

      console.error(error);

      setMessage(
        "Failed to add publication"
      );

    } finally {

      setLoading(false);

    }

  };


  // ===================================================
  // START EDIT
  // ===================================================

  const startEdit = (publication) => {

    setEditingId(
      publication._id
    );

    setPaperTitle(
      publication.paperTitle || ""
    );

    setPublicationType(
      publication.publicationType ||
      "Journal"
    );

    setJournalConference(
      publication.journalConference ||
      ""
    );

    setPublicationYear(
      publication.publicationYear || ""
    );

    setDOI(
      publication.DOI || ""
    );

    setMessage("");

    setActivePage(
      currentRole === "admin"
        ? "edit"
        : "add"
    );

  };


  // ===================================================
  // UPDATE PUBLICATION
  // ===================================================

  const updatePublication = async (e) => {

    e.preventDefault();

    if (!editingId) return;

    setLoading(true);
    setMessage("");

    try {

      const response = await fetch(
        `${API}/publications/${editingId}`,
        {

          method: "PUT",

          headers: {

            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${token}`

          },

          body: JSON.stringify({

            paperTitle:
              paperTitle.trim(),

            publicationType,

            journalConference:
              journalConference.trim(),

            publicationYear:
              Number(publicationYear),

            DOI:
              DOI.trim()

          })

        }
      );

      const data =
        await response.json();

      if (!response.ok) {

        setMessage(
          data.message ||
          "Update failed"
        );

        return;
      }

      setMessage(
        "Publication updated successfully."
      );

      clearForm();

      await fetchPublications();

      setActivePage(
        "publications"
      );

    } catch (error) {

      console.error(error);

      setMessage(
        "Update failed"
      );

    } finally {

      setLoading(false);

    }

  };


  // ===================================================
  // DELETE PUBLICATION
  // ===================================================

  const deletePublication = async (id) => {

    const confirmed =
      window.confirm(
        "Are you sure you want to delete this publication?"
      );

    if (!confirmed) return;

    try {

      const response = await fetch(
        `${API}/publications/${id}`,
        {

          method: "DELETE",

          headers: {

            Authorization:
              `Bearer ${token}`

          }

        }
      );

      const data =
        await response.json();

      if (!response.ok) {

        alert(
          data.message ||
          "Delete failed"
        );

        return;
      }

      await fetchPublications();

      if (currentRole === "admin") {
        await fetchReport();
      }

    } catch (error) {

      console.error(error);

      alert(
        "Failed to delete publication"
      );

    }

  };


  // ===================================================
  // VERIFY PUBLICATION
  // ===================================================

  const verifyPublication = async (
    id,
    status,
    rejectionReason = ""
  ) => {

    if (
      status === "Rejected" &&
      !rejectionReason.trim()
    ) {

      alert(
        "Please provide a rejection reason."
      );

      return;
    }

    try {

      const response = await fetch(
        `${API}/publications/${id}/verify`,
        {

          method: "PUT",

          headers: {

            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${token}`

          },

          body: JSON.stringify({

            verificationStatus:
              status,

            rejectionReason:
              rejectionReason.trim()

          })

        }
      );

      const data =
        await response.json();

      if (!response.ok) {

        alert(
          data.message ||
          "Verification failed"
        );

        return;
      }

      await fetchPublications();

      await fetchReport();

      await fetchNotifications();

    } catch (error) {

      console.error(error);

      alert(
        "Failed to update publication status"
      );

    }

  };


  // ===================================================
  // REJECT PUBLICATION
  // ===================================================

  const rejectPublication = async (
    publication
  ) => {

    const reason =
      window.prompt(
        "Enter rejection reason:"
      );

    if (
      reason === null
    ) {
      return;
    }

    if (!reason.trim()) {

      alert(
        "Rejection reason is required."
      );

      return;
    }

    await verifyPublication(
      publication._id,
      "Rejected",
      reason
    );

  };


  // ===================================================
  // RESUBMIT PUBLICATION
  // ===================================================

  const resubmitPublication = async (
    id
  ) => {

    try {

      const response = await fetch(
        `${API}/publications/${id}/resubmit`,
        {

          method: "PUT",

          headers: {

            Authorization:
              `Bearer ${token}`

          }

        }
      );

      const data =
        await response.json();

      if (!response.ok) {

        alert(
          data.message ||
          "Resubmission failed"
        );

        return;
      }

      await fetchPublications();

      await fetchNotifications();

    } catch (error) {

      console.error(error);

      alert(
        "Failed to resubmit publication"
      );

    }

  };


  // ===================================================
  // FETCH REPORT
  // ===================================================

  const fetchReport = async () => {

    const currentToken =
      localStorage.getItem("token");

    if (!currentToken) return;

    try {

      const response = await fetch(
        `${API}/admin/report`,
        {

          headers: {

            Authorization:
              `Bearer ${currentToken}`

          }

        }
      );

      const result =
        await response.json();

      if (!response.ok) return;

      /*
       * Backend:
       * {
       *   success: true,
       *   data: {...}
       * }
       */

      setReport(
        result.data || null
      );

    } catch (error) {

      console.error(
        "Report error:",
        error
      );

    }

  };


  // ===================================================
  // FETCH NOTIFICATIONS
  // ===================================================

  const fetchNotifications = async () => {

    const currentToken =
      localStorage.getItem("token");

    if (!currentToken) return;

    try {

      const response = await fetch(
        `${API}/notifications`,
        {

          headers: {

            Authorization:
              `Bearer ${currentToken}`

          }

        }
      );

      const result =
        await response.json();

      if (!response.ok) return;

      setNotifications(
        Array.isArray(result.data)
          ? result.data
          : []
      );

      setUnreadCount(
        result.unreadCount || 0
      );

    } catch (error) {

      console.error(
        "Notification error:",
        error
      );

    }

  };


  // ===================================================
  // MARK NOTIFICATION READ
  // ===================================================

  const markNotificationRead = async (
    id
  ) => {

    try {

      await fetch(
        `${API}/notifications/${id}/read`,
        {

          method: "PUT",

          headers: {

            Authorization:
              `Bearer ${token}`

          }

        }
      );

      await fetchNotifications();

    } catch (error) {

      console.error(error);

    }

  };


  // ===================================================
  // MARK ALL READ
  // ===================================================

  const markAllNotificationsRead =
    async () => {

      try {

        await fetch(
          `${API}/notifications/read-all`,
          {

            method: "PUT",

            headers: {

              Authorization:
                `Bearer ${token}`

            }

          }
        );

        await fetchNotifications();

      } catch (error) {

        console.error(error);

      }

    };


  // ===================================================
  // EXPORT CSV
  // ===================================================

  const exportPublications = async () => {

    try {

      const response = await fetch(
        `${API}/admin/publications/export`,
        {

          headers: {

            Authorization:
              `Bearer ${token}`

          }

        }
      );

      if (!response.ok) {

        alert(
          "Unable to export publications"
        );

        return;
      }

      const blob =
        await response.blob();

      const url =
        window.URL.createObjectURL(
          blob
        );

      const link =
        document.createElement("a");

      link.href = url;

      link.download =
        "publications-report.csv";

      document.body.appendChild(
        link
      );

      link.click();

      link.remove();

      window.URL.revokeObjectURL(
        url
      );

    } catch (error) {

      console.error(error);

      alert(
        "Export failed"
      );

    }

  };


  // ===================================================
  // CLEAR FORM
  // ===================================================

  const clearForm = () => {

    setPaperTitle("");

    setPublicationType(
      "Journal"
    );

    setJournalConference("");

    setPublicationYear("");

    setDOI("");

    setEditingId(null);

  };


  // ===================================================
  // LOGOUT
  // ===================================================

  const logout = () => {

    localStorage.removeItem(
      "token"
    );

    localStorage.removeItem(
      "role"
    );

    setLoggedIn(false);

    setPublications([]);

    setReport(null);

    setNotifications([]);

    setUnreadCount(0);

    clearForm();

    setActivePage(
      "dashboard"
    );

  };


  // ===================================================
  // LOGIN / REGISTER SCREEN
  // ===================================================

  if (!loggedIn) {

    return (

      <div className="app">

        <div className="login-container">

          <div className="form-section">

            <div className="form-inner">

              <div className="form-eyebrow">
                RESEARCH PUBLICATION PORTAL
              </div>

              <h2>
                {isRegister
                  ? "Create Account"
                  : "Login"}
              </h2>

              <p className="subtitle">
                {isRegister
                  ? "Create your portal account"
                  : "Sign in to continue"}
              </p>


              <form
                onSubmit={handleAuth}
              >

                {isRegister && (

                  <div className="input-group">

                    <label>
                      Full Name
                    </label>

                    <input
                      type="text"
                      placeholder="Enter your name"
                      value={name}
                      onChange={(e) =>
                        setName(
                          e.target.value
                        )
                      }
                      required
                    />

                  </div>

                )}


                <div className="input-group">

                  <label>
                    Email
                  </label>

                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) =>
                      setEmail(
                        e.target.value
                      )
                    }
                    required
                  />

                </div>


                <div className="input-group">

                  <label>
                    Password
                  </label>

                  <input
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) =>
                      setPassword(
                        e.target.value
                      )
                    }
                    required
                  />

                </div>


                {isRegister && (

                  <div className="input-group">

                    <label>
                      Role
                    </label>

                    <select
                      value={role}
                      onChange={(e) =>
                        setRole(
                          e.target.value
                        )
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

                )}


                <button
                  type="submit"
                  className="primary-btn"
                  disabled={loading}
                >

                  {loading
                    ? "Please wait..."
                    : isRegister
                    ? "Create Account"
                    : "Login"}

                </button>

              </form>


              {message && (

                <div className="message">
                  {message}
                </div>

              )}


              <p className="switch-text">

                {isRegister
                  ? "Already have an account?"
                  : "Don't have an account?"}

                <button
                  className="switch-btn"
                  onClick={() => {

                    setIsRegister(
                      !isRegister
                    );

                    setMessage("");

                  }}
                >

                  {isRegister
                    ? "Login"
                    : "Register"}

                </button>

              </p>


              <div className="secure-note">
                Secure access to research publication records
              </div>

            </div>

          </div>

        </div>

      </div>

    );

  }


  // ===================================================
  // ADMIN
  // ===================================================

  if (
    currentRole === "admin"
  ) {

    return (

      <AdminDashboard

        activePage={
          activePage
        }

        setActivePage={
          setActivePage
        }

        publications={
          publications
        }

        report={
          report
        }

        notifications={
          notifications
        }

        unreadCount={
          unreadCount
        }

        fetchPublications={
          fetchPublications
        }

        fetchReport={
          fetchReport
        }

        fetchNotifications={
          fetchNotifications
        }

        verifyPublication={
          verifyPublication
        }

        rejectPublication={
          rejectPublication
        }

        deletePublication={
          deletePublication
        }

        startEdit={
          startEdit
        }

        logout={
          logout
        }

        editingId={
          editingId
        }

        paperTitle={
          paperTitle
        }

        setPaperTitle={
          setPaperTitle
        }

        publicationType={
          publicationType
        }

        setPublicationType={
          setPublicationType
        }

        journalConference={
          journalConference
        }

        setJournalConference={
          setJournalConference
        }

        publicationYear={
          publicationYear
        }

        setPublicationYear={
          setPublicationYear
        }

        DOI={
          DOI
        }

        setDOI={
          setDOI
        }

        addPublication={
          addPublication
        }

        updatePublication={
          updatePublication
        }

        clearForm={
          clearForm
        }

        message={
          message
        }

        searchText={
          searchText
        }

        setSearchText={
          setSearchText
        }

        typeFilter={
          typeFilter
        }

        setTypeFilter={
          setTypeFilter
        }

        statusFilter={
          statusFilter
        }

        setStatusFilter={
          setStatusFilter
        }

        yearFilter={
          yearFilter
        }

        setYearFilter={
          setYearFilter
        }

        markNotificationRead={
          markNotificationRead
        }

        markAllNotificationsRead={
          markAllNotificationsRead
        }

        exportPublications={
          exportPublications
        }

      />

    );

  }


  // ===================================================
  // FACULTY
  // ===================================================

  return (

    <FacultyDashboard

      activePage={
        activePage
      }

      setActivePage={
        setActivePage
      }

      publications={
        publications
      }

      message={
        message
      }

      setMessage={
        setMessage
      }

      paperTitle={
        paperTitle
      }

      setPaperTitle={
        setPaperTitle
      }

      publicationType={
        publicationType
      }

      setPublicationType={
        setPublicationType
      }

      journalConference={
        journalConference
      }

      setJournalConference={
        setJournalConference
      }

      publicationYear={
        publicationYear
      }

      setPublicationYear={
        setPublicationYear
      }

      DOI={
        DOI
      }

      setDOI={
        setDOI
      }

      addPublication={
        addPublication
      }

      updatePublication={
        updatePublication
      }

      editingId={
        editingId
      }

      clearForm={
        clearForm
      }

      fetchPublications={
        fetchPublications
      }

      startEdit={
        startEdit
      }

      deletePublication={
        deletePublication
      }

      resubmitPublication={
        resubmitPublication
      }

      logout={
        logout
      }

      notifications={
        notifications
      }

      unreadCount={
        unreadCount
      }

      fetchNotifications={
        fetchNotifications
      }

      markNotificationRead={
        markNotificationRead
      }

      markAllNotificationsRead={
        markAllNotificationsRead
      }

      searchText={
        searchText
      }

      setSearchText={
        setSearchText
      }

      typeFilter={
        typeFilter
      }

      setTypeFilter={
        setTypeFilter
      }

      statusFilter={
        statusFilter
      }

      setStatusFilter={
        setStatusFilter
      }

      yearFilter={
        yearFilter
      }

      setYearFilter={
        setYearFilter
      }

    />

  );

}


// =====================================================
// FACULTY DASHBOARD
// =====================================================

function FacultyDashboard({

  activePage,
  setActivePage,
  publications,
  message,
  setMessage,

  paperTitle,
  setPaperTitle,

  publicationType,
  setPublicationType,

  journalConference,
  setJournalConference,

  publicationYear,
  setPublicationYear,

  DOI,
  setDOI,

  addPublication,
  updatePublication,

  editingId,
  clearForm,

  fetchPublications,
  startEdit,
  deletePublication,
  resubmitPublication,

  logout,

  notifications,
  unreadCount,
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,

  searchText,
  setSearchText,

  typeFilter,
  setTypeFilter,

  statusFilter,
  setStatusFilter,

  yearFilter,
  setYearFilter

}) {

  const filteredPublications =
    filterPublications(
      publications,
      searchText,
      typeFilter,
      statusFilter,
      yearFilter
    );


  return (

    <div className="dashboard">

      <Header
        title="Research Publication Portal"
        subtitle="Faculty Dashboard"
        logout={logout}
        unreadCount={unreadCount}
        onNotifications={() =>
          setActivePage(
            "notifications"
          )
        }
      />


      <div className="dashboard-layout">

        <Sidebar
          activePage={activePage}
          setActivePage={setActivePage}
          isAdmin={false}
          unreadCount={unreadCount}
        />


        <main className="main-content">


          {activePage === "dashboard" && (

            <>

              <PageTitle
                title="Faculty Dashboard"
                text="Manage your research publications from one place."
              />


              <Stats
                publications={
                  publications
                }
              />


              <div className="content-card">

                <div className="card-header">

                  <div>
                    <h3>
                      Recent Publications
                    </h3>

                    <p>
                      Your latest research submissions
                    </p>
                  </div>

                  <button
                    className="small-btn"
                    onClick={
                      fetchPublications
                    }
                  >
                    Refresh
                  </button>

                </div>


                {publications.length === 0 ? (

                  <EmptyState
                    title="No publications yet"
                    text="Add your first research publication."
                    button="Add Publication"
                    onClick={() =>
                      setActivePage(
                        "add"
                      )
                    }
                  />

                ) : (

                  <PublicationList

                    publications={
                      publications.slice(
                        0,
                        5
                      )
                    }

                    isAdmin={false}

                    onEdit={
                      startEdit
                    }

                    onDelete={
                      deletePublication
                    }

                    onResubmit={
                      resubmitPublication
                    }

                  />

                )}

              </div>

            </>

          )}


          {activePage === "add" && (

            <PublicationForm

              editingId={
                editingId
              }

              paperTitle={
                paperTitle
              }

              setPaperTitle={
                setPaperTitle
              }

              publicationType={
                publicationType
              }

              setPublicationType={
                setPublicationType
              }

              journalConference={
                journalConference
              }

              setJournalConference={
                setJournalConference
              }

              publicationYear={
                publicationYear
              }

              setPublicationYear={
                setPublicationYear
              }

              DOI={
                DOI
              }

              setDOI={
                setDOI
              }

              addPublication={
                addPublication
              }

              updatePublication={
                updatePublication
              }

              clearForm={
                clearForm
              }

              message={
                message
              }

            />

          )}


          {activePage === "publications" && (

            <div className="content-card">

              <PageTitle
                title="My Publications"
                text="View and manage your publication history."
              />


              <PublicationFilters

                searchText={
                  searchText
                }

                setSearchText={
                  setSearchText
                }

                typeFilter={
                  typeFilter
                }

                setTypeFilter={
                  setTypeFilter
                }

                statusFilter={
                  statusFilter
                }

                setStatusFilter={
                  setStatusFilter
                }

                yearFilter={
                  yearFilter
                }

                setYearFilter={
                  setYearFilter
                }

              />


              <PublicationList

                publications={
                  filteredPublications
                }

                isAdmin={false}

                onEdit={
                  startEdit
                }

                onDelete={
                  deletePublication
                }

                onResubmit={
                  resubmitPublication
                }

              />

            </div>

          )}


          {activePage === "search" && (

            <div className="content-card">

              <PageTitle
                title="Search Publications"
                text="Search your publication records."
              />


              <PublicationFilters

                searchText={
                  searchText
                }

                setSearchText={
                  setSearchText
                }

                typeFilter={
                  typeFilter
                }

                setTypeFilter={
                  setTypeFilter
                }

                statusFilter={
                  statusFilter
                }

                setStatusFilter={
                  setStatusFilter
                }

                yearFilter={
                  yearFilter
                }

                setYearFilter={
                  setYearFilter
                }

              />


              <PublicationList

                publications={
                  filteredPublications
                }

                isAdmin={false}

                onEdit={
                  startEdit
                }

                onDelete={
                  deletePublication
                }

                onResubmit={
                  resubmitPublication
                }

              />

            </div>

          )}


          {activePage === "notifications" && (

            <Notifications

              notifications={
                notifications
              }

              unreadCount={
                unreadCount
              }

              fetchNotifications={
                fetchNotifications
              }

              markNotificationRead={
                markNotificationRead
              }

              markAllNotificationsRead={
                markAllNotificationsRead
              }

            />

          )}

        </main>

      </div>

    </div>

  );

}


// =====================================================
// ADMIN DASHBOARD
// =====================================================

function AdminDashboard({

  activePage,
  setActivePage,

  publications,
  report,

  notifications,
  unreadCount,

  fetchPublications,
  fetchReport,
  fetchNotifications,

  verifyPublication,
  rejectPublication,

  deletePublication,
  startEdit,

  logout,

  editingId,

  paperTitle,
  setPaperTitle,

  publicationType,
  setPublicationType,

  journalConference,
  setJournalConference,

  publicationYear,
  setPublicationYear,

  DOI,
  setDOI,

  addPublication,
  updatePublication,

  clearForm,
  message,

  searchText,
  setSearchText,

  typeFilter,
  setTypeFilter,

  statusFilter,
  setStatusFilter,

  yearFilter,
  setYearFilter,

  markNotificationRead,
  markAllNotificationsRead,

  exportPublications

}) {

  const filteredPublications =
    filterPublications(
      publications,
      searchText,
      typeFilter,
      statusFilter,
      yearFilter
    );


  return (

    <div className="dashboard">

      <Header
        title="Research Publication Portal"
        subtitle="Admin Dashboard"
        logout={logout}
        unreadCount={unreadCount}
        onNotifications={() =>
          setActivePage(
            "notifications"
          )
        }
      />


      <div className="dashboard-layout">

        <Sidebar
          activePage={
            activePage
          }

          setActivePage={
            setActivePage
          }

          isAdmin={true}

          unreadCount={
            unreadCount
          }
        />


        <main className="main-content">


          {activePage === "dashboard" && (

            <>

              <PageTitle
                title="Admin Dashboard"
                text="Monitor and verify faculty research publications."
              />


              <AdminStats
                report={
                  report
                }
              />


              <div className="content-card">

                <div className="card-header">

                  <div>

                    <h3>
                      Recent Publications
                    </h3>

                    <p>
                      Faculty submissions requiring management
                    </p>

                  </div>


                  <button
                    className="small-btn"
                    onClick={() => {

                      fetchPublications();

                      fetchReport();

                    }}
                  >
                    Refresh
                  </button>

                </div>


                <PublicationList

                  publications={
                    publications.slice(
                      0,
                      5
                    )
                  }

                  isAdmin={true}

                  onVerify={
                    verifyPublication
                  }

                  onReject={
                    rejectPublication
                  }

                  onEdit={
                    startEdit
                  }

                  onDelete={
                    deletePublication
                  }

                />

              </div>

            </>

          )}


          {activePage === "publications" && (

            <div className="content-card">

              <PageTitle
                title="Manage Publications"
                text="Review, verify and manage faculty publications."
              />


              <PublicationFilters

                searchText={
                  searchText
                }

                setSearchText={
                  setSearchText
                }

                typeFilter={
                  typeFilter
                }

                setTypeFilter={
                  setTypeFilter
                }

                statusFilter={
                  statusFilter
                }

                setStatusFilter={
                  setStatusFilter
                }

                yearFilter={
                  yearFilter
                }

                setYearFilter={
                  setYearFilter
                }

              />


              <PublicationList

                publications={
                  filteredPublications
                }

                isAdmin={true}

                onVerify={
                  verifyPublication
                }

                onReject={
                  rejectPublication
                }

                onEdit={
                  startEdit
                }

                onDelete={
                  deletePublication
                }

              />

            </div>

          )}


          {activePage === "search" && (

            <div className="content-card">

              <PageTitle
                title="Search Publications"
                text="Search and filter all faculty publication records."
              />


              <PublicationFilters

                searchText={
                  searchText
                }

                setSearchText={
                  setSearchText
                }

                typeFilter={
                  typeFilter
                }

                setTypeFilter={
                  setTypeFilter
                }

                statusFilter={
                  statusFilter
                }

                setStatusFilter={
                  setStatusFilter
                }

                yearFilter={
                  yearFilter
                }

                setYearFilter={
                  setYearFilter
                }

              />


              <PublicationList

                publications={
                  filteredPublications
                }

                isAdmin={true}

                onVerify={
                  verifyPublication
                }

                onReject={
                  rejectPublication
                }

                onEdit={
                  startEdit
                }

                onDelete={
                  deletePublication
                }

              />

            </div>

          )}


          {activePage === "edit" && (

            <PublicationForm

              editingId={
                editingId
              }

              paperTitle={
                paperTitle
              }

              setPaperTitle={
                setPaperTitle
              }

              publicationType={
                publicationType
              }

              setPublicationType={
                setPublicationType
              }

              journalConference={
                journalConference
              }

              setJournalConference={
                setJournalConference
              }

              publicationYear={
                publicationYear
              }

              setPublicationYear={
                setPublicationYear
              }

              DOI={
                DOI
              }

              setDOI={
                setDOI
              }

              addPublication={
                addPublication
              }

              updatePublication={
                updatePublication
              }

              clearForm={
                clearForm
              }

              message={
                message
              }

            />

          )}


          {activePage === "reports" && (

            <AdminReports

              report={
                report
              }

              fetchReport={
                fetchReport
              }

              exportPublications={
                exportPublications
              }

            />

          )}


          {activePage === "notifications" && (

            <Notifications

              notifications={
                notifications
              }

              unreadCount={
                unreadCount
              }

              fetchNotifications={
                fetchNotifications
              }

              markNotificationRead={
                markNotificationRead
              }

              markAllNotificationsRead={
                markAllNotificationsRead
              }

            />

          )}

        </main>

      </div>

    </div>

  );

}


// =====================================================
// HEADER
// =====================================================

function Header({

  title,
  subtitle,
  logout,
  unreadCount,
  onNotifications

}) {

  return (

    <header className="dashboard-header">

      <div className="brand">

        <div className="brand-logo">
          RP
        </div>

        <div>

          <h1>
            {title}
          </h1>

          <p>
            {subtitle}
          </p>

        </div>

      </div>


      <div className="header-actions">

        <button
          className="notification-btn"
          onClick={
            onNotifications
          }
          title="Notifications"
        >

          🔔

          {unreadCount > 0 && (

            <span className="notification-count">
              {unreadCount}
            </span>

          )}

        </button>


        <button
          className="logout-btn"
          onClick={logout}
        >
          Logout
        </button>

      </div>

    </header>

  );

}


// =====================================================
// SIDEBAR
// =====================================================

function Sidebar({

  activePage,
  setActivePage,
  isAdmin,
  unreadCount

}) {

  const itemClass = (page) =>
    activePage === page
      ? "nav-btn active"
      : "nav-btn";


  return (

    <aside className="sidebar">

      <button
        className={
          itemClass("dashboard")
        }
        onClick={() =>
          setActivePage(
            "dashboard"
          )
        }
      >
        🏠 Dashboard
      </button>


      {!isAdmin && (

        <button
          className={
            itemClass("add")
          }
          onClick={() =>
            setActivePage(
              "add"
            )
          }
        >
          ➕ Add Publication
        </button>

      )}


      <button
        className={
          itemClass(
            "publications"
          )
        }
        onClick={() =>
          setActivePage(
            "publications"
          )
        }
      >
        📚 {isAdmin
          ? "Manage Publications"
          : "My Publications"}
      </button>


      <button
        className={
          itemClass("search")
        }
        onClick={() =>
          setActivePage(
            "search"
          )
        }
      >
        🔎 Search Publications
      </button>


      {isAdmin && (

        <button
          className={
            itemClass("reports")
          }
          onClick={() =>
            setActivePage(
              "reports"
            )
          }
        >
          📊 Reports
        </button>

      )}


      <button
        className={
          itemClass(
            "notifications"
          )
        }
        onClick={() =>
          setActivePage(
            "notifications"
          )
        }
      >

        🔔 Notifications

        {unreadCount > 0 && (

          <span className="sidebar-badge">
            {unreadCount}
          </span>

        )}

      </button>

    </aside>

  );

}


// =====================================================
// PAGE TITLE
// =====================================================

function PageTitle({
  title,
  text
}) {

  return (

    <div className="page-title">

      <h2>
        {title}
      </h2>

      <p>
        {text}
      </p>

    </div>

  );

}


// =====================================================
// FACULTY STATS
// =====================================================

function Stats({
  publications
}) {

  const verified =
    publications.filter(
      (p) =>
        p.verificationStatus ===
        "Verified"
    ).length;


  const pending =
    publications.filter(
      (p) =>
        p.verificationStatus ===
        "Pending"
    ).length;


  const rejected =
    publications.filter(
      (p) =>
        p.verificationStatus ===
        "Rejected"
    ).length;


  return (

    <div className="stats-grid">

      <StatCard
        icon="📚"
        title="Total Publications"
        value={
          publications.length
        }
      />

      <StatCard
        icon="✓"
        title="Verified"
        value={
          verified
        }
      />

      <StatCard
        icon="⏳"
        title="Pending"
        value={
          pending
        }
      />

      <StatCard
        icon="!"
        title="Rejected"
        value={
          rejected
        }
      />

    </div>

  );

}


// =====================================================
// ADMIN STATS
// =====================================================

function AdminStats({
  report
}) {

  if (!report) {

    return (

      <div className="stats-grid">

        <div className="stat-card">
          Loading...
        </div>

      </div>

    );

  }


  return (

    <div className="stats-grid">

      <StatCard
        icon="👨‍🏫"
        title="Total Faculty"
        value={
          report.totalFaculty || 0
        }
      />

      <StatCard
        icon="📚"
        title="Total Publications"
        value={
          report.totalPublications || 0
        }
      />

      <StatCard
        icon="✓"
        title="Verified"
        value={
          report.verifiedPublications || 0
        }
      />

      <StatCard
        icon="⏳"
        title="Pending"
        value={
          report.pendingPublications || 0
        }
      />

      <StatCard
        icon="!"
        title="Rejected"
        value={
          report.rejectedPublications || 0
        }
      />

    </div>

  );

}


// =====================================================
// STAT CARD
// =====================================================

function StatCard({
  icon,
  title,
  value
}) {

  return (

    <div className="stat-card">

      <div className="stat-icon">
        {icon}
      </div>

      <div>

        <span>
          {title}
        </span>

        <strong>
          {value}
        </strong>

      </div>

    </div>

  );

}


// =====================================================
// PUBLICATION FORM
// =====================================================

function PublicationForm({

  editingId,

  paperTitle,
  setPaperTitle,

  publicationType,
  setPublicationType,

  journalConference,
  setJournalConference,

  publicationYear,
  setPublicationYear,

  DOI,
  setDOI,

  addPublication,
  updatePublication,

  clearForm,
  message

}) {

  return (

    <div className="content-card">

      <PageTitle

        title={
          editingId
            ? "Edit Publication"
            : "Add Publication"
        }

        text={
          editingId
            ? "Update your publication details."
            : "Enter your research publication details."
        }

      />


      <form

        className="publication-form"

        onSubmit={
          editingId
            ? updatePublication
            : addPublication
        }

      >

        <div className="input-group">

          <label>
            Paper Title
          </label>

          <input
            type="text"
            placeholder="Enter research paper title"
            value={paperTitle}
            onChange={(e) =>
              setPaperTitle(
                e.target.value
              )
            }
            required
          />

        </div>


        <div className="form-row">

          <div className="input-group">

            <label>
              Publication Type
            </label>

            <select

              value={
                publicationType
              }

              onChange={(e) =>
                setPublicationType(
                  e.target.value
                )
              }

            >

              <option value="Journal">
                Journal
              </option>

              <option value="Conference">
                Conference
              </option>

              <option value="Book Chapter">
                Book Chapter
              </option>

              <option value="Patent">
                Patent
              </option>

            </select>

          </div>


          <div className="input-group">

            <label>
              Publication Year
            </label>

            <input
              type="number"
              min="1900"
              max="2100"
              placeholder="2026"
              value={
                publicationYear
              }
              onChange={(e) =>
                setPublicationYear(
                  e.target.value
                )
              }
              required
            />

          </div>

        </div>


        <div className="input-group">

          <label>
            Journal / Conference
          </label>

          <input
            type="text"
            placeholder="Enter journal or conference name"
            value={
              journalConference
            }
            onChange={(e) =>
              setJournalConference(
                e.target.value
              )
            }
            required
          />

        </div>


        <div className="input-group">

          <label>
            DOI
          </label>

          <input
            type="text"
            placeholder="Enter DOI"
            value={DOI}
            onChange={(e) =>
              setDOI(
                e.target.value
              )
            }
          />

        </div>


        <div className="form-actions">

          <button
            className="primary-btn"
            type="submit"
          >

            {editingId
              ? "Update Publication"
              : "Add Publication"}

          </button>


          {editingId && (

            <button
              type="button"
              className="cancel-btn"
              onClick={
                clearForm
              }
            >
              Cancel
            </button>

          )}

        </div>

      </form>


      {message && (

        <div className="message">
          {message}
        </div>

      )}

    </div>

  );

}


// =====================================================
// PUBLICATION FILTERS
// =====================================================

function PublicationFilters({

  searchText,
  setSearchText,

  typeFilter,
  setTypeFilter,

  statusFilter,
  setStatusFilter,

  yearFilter,
  setYearFilter

}) {

  return (

    <div className="filter-bar">

      <input
        type="text"
        placeholder="Search title, journal or DOI..."
        value={
          searchText
        }
        onChange={(e) =>
          setSearchText(
            e.target.value
          )
        }
      />


      <select
        value={
          typeFilter
        }
        onChange={(e) =>
          setTypeFilter(
            e.target.value
          )
        }
      >

        <option value="All">
          All Types
        </option>

        <option value="Journal">
          Journal
        </option>

        <option value="Conference">
          Conference
        </option>

        <option value="Book Chapter">
          Book Chapter
        </option>

        <option value="Patent">
          Patent
        </option>

      </select>


      <select
        value={
          statusFilter
        }
        onChange={(e) =>
          setStatusFilter(
            e.target.value
          )
        }
      >

        <option value="All">
          All Status
        </option>

        <option value="Pending">
          Pending
        </option>

        <option value="Verified">
          Verified
        </option>

        <option value="Rejected">
          Rejected
        </option>

      </select>


      <select
        value={
          yearFilter
        }
        onChange={(e) =>
          setYearFilter(
            e.target.value
          )
        }
      >

        <option value="All">
          All Years
        </option>

        {Array.from(
          {
            length: 11
          },
          (_, i) =>
            new Date().getFullYear() - i
        ).map(
          (year) => (

            <option
              key={year}
              value={year}
            >
              {year}
            </option>

          )
        )}

      </select>

    </div>

  );

}


// =====================================================
// FILTER FUNCTION
// =====================================================

function filterPublications(

  publications,
  searchText,
  typeFilter,
  statusFilter,
  yearFilter

) {

  return publications.filter(
    (publication) => {

      const search =
        searchText
          .trim()
          .toLowerCase();


      const matchesSearch =
        !search ||
        publication.paperTitle
          ?.toLowerCase()
          .includes(search) ||
        publication.journalConference
          ?.toLowerCase()
          .includes(search) ||
        publication.DOI
          ?.toLowerCase()
          .includes(search);


      const matchesType =
        typeFilter === "All" ||
        publication.publicationType ===
          typeFilter;


      const matchesStatus =
        statusFilter === "All" ||
        publication.verificationStatus ===
          statusFilter;


      const matchesYear =
        yearFilter === "All" ||
        String(
          publication.publicationYear
        ) ===
          String(yearFilter);


      return (
        matchesSearch &&
        matchesType &&
        matchesStatus &&
        matchesYear
      );

    }
  );

}


// =====================================================
// PUBLICATION LIST
// =====================================================

function PublicationList({

  publications,
  isAdmin,

  onVerify,
  onReject,

  onEdit,
  onDelete,

  onResubmit

}) {

  if (
    publications.length === 0
  ) {

    return (

      <EmptyState

        title="No publications found"

        text="There are no publications matching your criteria."

      />

    );

  }


  return (

    <div className="publication-list">

      {publications.map(
        (publication) => (

          <div

            className="publication-item"

            key={
              publication._id
            }

          >

            <div className="publication-info">

              <h3>
                {
                  publication.paperTitle
                }
              </h3>


              <p>

                {
                  publication.publicationType
                }

                {" • "}

                {
                  publication.publicationYear
                }

              </p>


              <p>

                {
                  publication.journalConference
                }

              </p>


              {publication.DOI && (

                <p className="doi">

                  DOI:
                  {" "}
                  {
                    publication.DOI
                  }

                </p>

              )}


              {isAdmin && (

                <p className="faculty-id">

                  Faculty ID:
                  {" "}
                  {
                    publication.facultyId
                  }

                </p>

              )}


              {publication.verificationStatus ===
                "Rejected" &&
                publication.rejectionReason && (

                <div className="rejection-reason">

                  <strong>
                    Rejection Reason:
                  </strong>

                  <span>
                    {
                      publication.rejectionReason
                    }
                  </span>

                </div>

              )}

            </div>


            <div className="publication-actions">

              <StatusBadge
                status={
                  publication.verificationStatus
                }
              />


              {isAdmin && (

                <div className="action-buttons">

                  {publication.verificationStatus !==
                    "Verified" && (

                    <button
                      className="verify-btn"
                      onClick={() =>
                        onVerify(
                          publication._id,
                          "Verified"
                        )
                      }
                    >
                      ✓ Verify
                    </button>

                  )}


                  {publication.verificationStatus !==
                    "Rejected" && (

                    <button
                      className="reject-btn"
                      onClick={() =>
                        onReject(
                          publication
                        )
                      }
                    >
                      ✕ Reject
                    </button>

                  )}


                  <button
                    className="edit-btn"
                    onClick={() =>
                      onEdit(
                        publication
                      )
                    }
                  >
                    ✏️ Edit
                  </button>


                  <button
                    className="delete-btn"
                    onClick={() =>
                      onDelete(
                        publication._id
                      )
                    }
                  >
                    🗑 Delete
                  </button>

                </div>

              )}


              {!isAdmin && (

                <div className="action-buttons">

                  <button
                    className="edit-btn"
                    onClick={() =>
                      onEdit(
                        publication
                      )
                    }
                  >
                    ✏️ Edit
                  </button>


                  <button
                    className="delete-btn"
                    onClick={() =>
                      onDelete(
                        publication._id
                      )
                    }
                  >
                    🗑 Delete
                  </button>


                  {publication.verificationStatus ===
                    "Rejected" && (

                    <button
                      className="resubmit-btn"
                      onClick={() =>
                        onResubmit(
                          publication._id
                        )
                      }
                    >
                      ↻ Resubmit
                    </button>

                  )}

                </div>

              )}

            </div>

          </div>

        )
      )}

    </div>

  );

}


// =====================================================
// STATUS BADGE
// =====================================================

function StatusBadge({
  status
}) {

  const className =
    status === "Verified"
      ? "status verified"
      : status === "Rejected"
      ? "status rejected"
      : "status pending";


  return (

    <span
      className={
        className
      }
    >
      {status}
    </span>

  );

}


// =====================================================
// NOTIFICATIONS
// =====================================================

function Notifications({

  notifications,
  unreadCount,

  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead

}) {

  return (

    <div className="content-card">

      <PageTitle

        title="Notifications"

        text={
          unreadCount > 0
            ? `${unreadCount} unread notification(s)`
            : "You are all caught up."
        }

      />


      <div className="notification-header">

        <button
          className="small-btn"
          onClick={
            fetchNotifications
          }
        >
          Refresh
        </button>


        {unreadCount > 0 && (

          <button
            className="small-btn"
            onClick={
              markAllNotificationsRead
            }
          >
            Mark all as read
          </button>

        )}

      </div>


      {notifications.length === 0 ? (

        <EmptyState

          title="No notifications"

          text="You don't have any notifications yet."

        />

      ) : (

        <div className="notifications-list">

          {notifications.map(
            (notification) => (

              <div

                className={
                  notification.isRead
                    ? "notification-item read"
                    : "notification-item unread"
                }

                key={
                  notification._id
                }

              >

                <div>

                  <h3>
                    {
                      notification.title
                    }
                  </h3>

                  <p>
                    {
                      notification.message
                    }
                  </p>

                  <small>
                    {
                      notification.createdAt
                        ? new Date(
                            notification.createdAt
                          ).toLocaleString()
                        : ""
                    }
                  </small>

                </div>


                {!notification.isRead && (

                  <button
                    className="small-btn"
                    onClick={() =>
                      markNotificationRead(
                        notification._id
                      )
                    }
                  >
                    Mark read
                  </button>

                )}

              </div>

            )
          )}

        </div>

      )}

    </div>

  );

}


// =====================================================
// ADMIN REPORTS
// =====================================================

function AdminReports({

  report,
  fetchReport,
  exportPublications

}) {

  if (!report) {

    return (

      <div className="content-card">

        Loading report...

      </div>

    );

  }


  return (

    <div className="content-card">

      <PageTitle

        title="Publication Reports"

        text="Overall research publication statistics."

      />


      <div className="report-grid">

        <div className="report-card">

          <span>
            Total Faculty
          </span>

          <strong>
            {
              report.totalFaculty || 0
            }
          </strong>

        </div>


        <div className="report-card">

          <span>
            Total Publications
          </span>

          <strong>
            {
              report.totalPublications || 0
            }
          </strong>

        </div>


        <div className="report-card">

          <span>
            Verified Publications
          </span>

          <strong>
            {
              report.verifiedPublications || 0
            }
          </strong>

        </div>


        <div className="report-card">

          <span>
            Pending Publications
          </span>

          <strong>
            {
              report.pendingPublications || 0
            }
          </strong>

        </div>


        <div className="report-card">

          <span>
            Rejected Publications
          </span>

          <strong>
            {
              report.rejectedPublications || 0
            }
          </strong>

        </div>

      </div>


      <div className="report-actions">

        <button
          className="small-btn"
          onClick={
            fetchReport
          }
        >
          Refresh Report
        </button>


        <button
          className="primary-small-btn"
          onClick={
            exportPublications
          }
        >
          Export CSV
        </button>

      </div>

    </div>

  );

}


// =====================================================
// EMPTY STATE
// =====================================================

function EmptyState({

  title,
  text,
  button,
  onClick

}) {

  return (

    <div className="empty-state">

      <div className="empty-icon">
        📄
      </div>


      <h3>
        {title}
      </h3>


      <p>
        {text}
      </p>


      {button && (

        <button
          className="primary-small-btn"
          onClick={
            onClick
          }
        >
          {button}
        </button>

      )}

    </div>

  );

}


export default App;