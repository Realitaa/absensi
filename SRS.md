# Software Requirements Specification (SRS)

## Web-Based Attendance System with GPS and Selfie Validation

**Document Status:** Updated Technical Specification\
**Project Context:** University Lecture Attendance

------------------------------------------------------------------------

# 1. Introduction

## 1.1 Purpose

This document specifies the functional and non-functional requirements
for a web-based attendance system that uses GPS geofencing and selfie
evidence to reduce attendance manipulation.

The system is intended for university lecture environments. It allows
students to submit attendance through a web browser while validating
their physical proximity to a designated classroom.

This document serves as the primary implementation reference for
developers and AI coding agents.

## 1.2 Scope

The system provides:

-   User authentication and role-based access.
-   User and classroom management.
-   Lecturer-managed attendance sessions.
-   GPS-based location validation.
-   Direct camera selfie capture.
-   Separate selfie upload and attendance submission processes.
-   Attendance history and reporting.
-   Attendance validation attempt logging.
-   Lecturer attendance corrections with audit trails.
-   Excel and PDF report exports.

The system does not implement facial recognition, automatic class
enrollment, academic course management, or guaranteed GPS spoofing
prevention.

## 1.3 User Roles

  -----------------------------------------------------------------------
  Role                                Description
  ----------------------------------- -----------------------------------
  Admin                               Manages users, rooms, global GPS
                                      settings, and system-wide
                                      attendance data.

  Lecturer                            Creates and manages attendance
                                      sessions and reviews attendance for
                                      their own sessions.

  Student                             Submits attendance and views
                                      personal attendance history.
  -----------------------------------------------------------------------

# 2. Authentication and User Management

## 2.1 Login and Authorization

**FR-AUTH-01:** All users must authenticate using their username and
password.

**FR-AUTH-02:** The system must provide different dashboards and
permissions based on user roles.

**FR-AUTH-03:** Only administrators can create user accounts.

**FR-AUTH-04:** Users may update their own profile information and
password.

## 2.2 User Information

Student accounts must have a unique Student Identification Number (NIM).
Lecturer accounts do not require an NIP field.

User accounts contain a name, username, password hash, role, and a NIM
for students. NIM is not applicable to non-student accounts.

**FR-AUTH-05:** Student NIM values must be unique.

## 2.3 User Soft Deletion

**FR-AUTH-06:** Administrators must be able to delete user accounts
using soft deletion.

A soft-deleted account:

-   Must no longer be allowed to authenticate.
-   Must not appear in ordinary active-user listings.
-   Must retain historical attendance records.
-   Must retain historical session ownership and audit references.
-   Must remain identifiable in historical reports.

Soft deletion must not cascade into deletion of attendance, session,
attempt, or correction records.

**FR-AUTH-07:** Usernames and student NIM values remain reserved across
active and soft-deleted accounts. They must not automatically become
available for reuse.

**FR-AUTH-08:** Historical records must continue referencing the
original user ID after soft deletion. The system must not replace
historical user references with a different account.

Account restoration is not included in the current scope unless
explicitly approved.

# 3. Room Management

Each room has a name, geographic coordinates (latitude and longitude),
and a configurable geofence radius.

**FR-ROOM-01:** Administrators can create, view, update, and delete
rooms.

**FR-ROOM-02:** Each room must have valid geographic coordinates.

**FR-ROOM-03:** The geofence radius must be configurable by
administrators.

**FR-ROOM-04:** The maximum permitted geofence radius is 20 meters.

**FR-ROOM-05:** A room referenced by an attendance session must not be
permanently deleted if doing so would break historical records.
Historical room references must be preserved.

# 4. Attendance Session Management

## 4.1 Session Creation

Lecturers manually create attendance sessions. Each session has:

-   A session name and description.
-   One lecturer as its owner.
-   One associated room.
-   A start time.
-   A late threshold time.
-   A scheduled closing time.
-   An optional manual closing timestamp.

Each session belongs to exactly one lecturer and one room.

## 4.2 Session Time Rules

Each session has three time parameters:

1.  Start time.
2.  Late threshold time.
3.  Closing time.

The following condition must always hold:

`start_time <= late_threshold_time < closing_time`

All application date and time interpretation must use the timezone
configured through the environment variable:

`APP_TIMEZONE=Asia/Jakarta`

Timezone configuration must be centralized rather than independently
defined in different application modules.

The server clock is authoritative for all attendance decisions.
Client-side device time must never determine whether a student is
present or late.

Database timestamps must use a consistent storage convention. If UTC
storage is used, timestamps must be converted using the configured
application timezone for display and session-time evaluation.

## 4.3 Session Status

Session status is derived from server time and manual closing state.

  Condition                                        Status
  ------------------------------------------------ ----------------
  Current time is before start time                Scheduled
  Start time reached and before late threshold     Open - Present
  Late threshold reached and before closing time   Open - Late
  Closing time reached                             Closed
  Lecturer manually closes the session             Closed

Manual closing takes precedence over scheduled time.

## 4.4 Session Requirements

**FR-SESSION-01:** Lecturers can create attendance sessions.

**FR-SESSION-02:** Lecturers can view their own sessions.

**FR-SESSION-03:** Lecturers can close their own sessions before the
scheduled closing time.

**FR-SESSION-04:** Lecturers cannot manually open a session before its
scheduled start time.

**FR-SESSION-05:** Sessions automatically become available when their
start time is reached.

**FR-SESSION-06:** Sessions automatically close when their closing time
is reached. Availability must be calculated from server time and must
not depend on a background job executing at an exact second.

**FR-SESSION-07:** All students with active accounts are eligible to
attend all available sessions. There is no class enrollment or
participant assignment mechanism.

**FR-SESSION-08:** Sessions without attendance records may be
permanently deleted. Sessions containing attendance records must not be
permanently deleted. There is no separate archive feature in the current
scope. Historical sessions remain accessible through reports and
attendance history.

# 5. Attendance Submission

## 5.1 Attendance Rules

**FR-ATT-01:** Students can view available attendance sessions.

**FR-ATT-02:** Students can submit attendance only when a session is
open.

**FR-ATT-03:** Each student may have only one official attendance record
per session.

**FR-ATT-04:** The database must enforce uniqueness for the combination
of student ID and session ID.

**FR-ATT-05:** Attendance status is determined by the server
timestamp: - Present: submitted before the late threshold. - Late:
submitted at or after the late threshold, but before session closing.

**FR-ATT-06:** The system must not automatically create Absent records
for students who do not submit attendance. Absence cannot be inferred
reliably because the system does not maintain a session participant
list.

**FR-ATT-07:** Students may manually retry attendance submission while
the session remains open.

**FR-ATT-08:** A successful attendance record must always have a valid
selfie reference. The system must never create an official attendance
record without selfie evidence.

# 6. GPS Validation

## 6.1 GPS Data Collection

The browser Geolocation API is used to obtain latitude, longitude, and
accuracy in meters.

The room's configured coordinates are used as the geofence center.

## 6.2 Distance Calculation

The system calculates the distance between the student's coordinates and
the room coordinates using the Haversine formula.

-   `d`: calculated distance.
-   `a`: GPS accuracy in meters.
-   `r`: room geofence radius in meters.

## 6.3 GPS Validation Policies

The administrator selects one global GPS validation policy.

**K1 - Distance Only**

`d <= r`

**K2 - Distance and Accuracy**

`d <= r AND a <= r`

**K3 - Conservative Accuracy-Aware Validation**

`d + a <= r`

Only one policy is active globally at a time. Each attendance attempt
must record the policy used during validation so historical data remains
interpretable after policy changes.

## 6.4 GPS Validation Requirements

**FR-GPS-01:** The client must perform an initial GPS validation before
opening the camera.

**FR-GPS-02:** If client-side GPS validation fails, the attempt must be
rejected immediately.

**FR-GPS-03:** A rejected GPS attempt must be logged.

**FR-GPS-04:** The client must not automatically retry GPS validation.
Students may manually retry while the session remains open.

**FR-GPS-05:** The server must independently recalculate distance and
apply the active GPS policy before creating an official attendance
record. Client-side validation is never authoritative.

**FR-GPS-06:** The server must validate that submitted coordinates and
accuracy are present and within acceptable numeric ranges.

**FR-GPS-07:** The server must use room coordinates and radius stored in
the database. It must not trust room coordinates or geofence radius
supplied by the client.

# 7. Selfie Capture and Upload

## 7.1 Selfie Capture

**FR-SELFIE-01:** Students must capture their selfie directly through
the browser camera.

**FR-SELFIE-02:** The system must use the browser `getUserMedia` API to
access the camera.

**FR-SELFIE-03:** Students must not upload existing images from their
device gallery as attendance selfies.

**FR-SELFIE-04:** Facial recognition is not part of the current system
scope. The selfie serves as visual attendance evidence only.

## 7.2 Separate Upload Process

Selfie upload and attendance submission are two separate operations.

1.  The client captures an image using the browser camera.
2.  The client uploads the image through a dedicated upload endpoint.
3.  The server validates and stores the image in private storage.
4.  The server returns the stored image path (`photo_path`).
5.  The client submits the attendance request containing the session ID,
    GPS data, accuracy, and `photo_path`.
6.  The server validates the upload reference and all attendance
    conditions before creating an official attendance record.

The attendance endpoint must not receive image binary data.

## 7.3 Upload Endpoint Requirements

**FR-UPLOAD-01:** The upload endpoint must require an authenticated
user.

**FR-UPLOAD-02:** The server must validate the uploaded file,
including: - Allowed image formats. - Actual file type, not only
filename extension. - Maximum file size. - Successful image storage.

Allowed formats and maximum file size must be configurable.

**FR-UPLOAD-03:** Uploaded selfies must be stored in private storage.
The database stores a path or reference rather than image binary data.

**FR-UPLOAD-04:** The upload endpoint returns a server-generated
`photo_path`.

**FR-UPLOAD-05:** The server must associate every uploaded image with
its authenticated owner.

**FR-UPLOAD-06:** An uploaded image initially has a pending or unused
state. Upload success alone does not make it an official attendance
attachment.

## 7.4 Attendance Endpoint Requirements

**FR-UPLOAD-07:** The attendance endpoint accepts `photo_path` instead
of image binary data.

**FR-UPLOAD-08:** The server must verify that the referenced upload: -
Exists. - Belongs to the authenticated student. - Is a valid image
upload. - Has not already been used by another attendance record. - Is
in an eligible state for attendance submission.

**FR-UPLOAD-09:** The server must reject arbitrary paths, references
belonging to other users, and references to nonexistent files.

**FR-UPLOAD-10:** An attendance record is created only after all
attendance and upload validations succeed.

**FR-UPLOAD-11:** After successful attendance creation, the upload must
be marked as consumed or attached to the attendance record. The
operation must prevent reuse of the same upload.

The implementation may use the actual server-generated storage path as
`photo_path`; an opaque upload ID is not required. However, the server
must still maintain enough metadata to verify ownership, existence, and
usage state. The client-supplied path must never be treated as trusted
filesystem input.

## 7.5 Failed Submission and Orphan Files

A selfie upload may succeed while the subsequent attendance submission
fails. Examples include failed server-side GPS validation, a closed
session, duplicate attendance, or an invalid upload reference.

In these cases, no official attendance record is created.

Unused uploaded images may become orphan files. The system should
provide a cleanup mechanism for expired uploads that have not been
attached to attendance records. Cleanup must never delete images
referenced by official attendance records.

## 7.6 Photo Access Control

Attendance photos must not expose unrestricted public URLs.

  Role       Photo Access
  ---------- -------------------------------------------
  Student    Own attendance photos
  Lecturer   Photos associated with their own sessions
  Admin      All attendance photos

The application must verify authorization before serving or generating
access to private photos.

# 8. Attendance Corrections

Lecturers may correct existing attendance records belonging to their own
sessions.

Supported corrected statuses: - Present. - Late. - Excused. - Sick.

**FR-CORRECTION-01:** Lecturers may change the status of an existing
attendance record.

**FR-CORRECTION-02:** Every correction requires a reason.

**FR-CORRECTION-03:** The system must record the attendance ID, lecturer
ID, previous status, new status, correction reason, and correction
timestamp.

**FR-CORRECTION-04:** Lecturers must not create an attendance record for
a student who never successfully submitted attendance with selfie
evidence.

**FR-CORRECTION-05:** Only the lecturer who owns the session and
administrators may access the relevant correction operations.

Correction history must remain available for audit purposes.

# 9. Reports and Attendance History

## 9.1 Report Access

  Role       Report Scope
  ---------- -------------------------------------------------------
  Admin      All sessions and attendance records
  Lecturer   Sessions and attendance records owned by the lecturer
  Student    Own attendance history

## 9.2 Report Filters

Reports must support filtering by date, session, lecturer, and room.

## 9.3 Export

The system must support Excel and PDF exports.

## 9.4 Historical Data

Historical attendance records remain accessible after user soft
deletion.

Reports must preserve references to original student and lecturer
accounts. The interface should clearly indicate when a referenced
account has been soft-deleted.

# 10. Data Integrity and Deletion Rules

## 10.1 User Soft Deletion

Deleting a user only updates the user's deletion state. It must not
cascade-delete: - Attendance sessions. - Attendance records. -
Attendance attempts. - Attendance corrections. - Historical photo
references.

## 10.2 Room Deletion

A room referenced by historical sessions must not be physically deleted
in a way that breaks those references.

## 10.3 Session Deletion

A session containing attendance records must not be permanently deleted.

## 10.4 Attendance Deletion

Official attendance records must not be deleted as a side effect of user
deletion. Any future attendance deletion capability must be explicitly
specified and preserve required audit information.

## 10.5 Photo Deletion

Photos referenced by official attendance records must not be removed by
temporary upload cleanup. Temporary and unused uploads may be deleted
after their configured expiration period.

# 11. Security Requirements

**NFR-SEC-01: Password Security**\
Passwords must be stored using a secure password hashing algorithm.
Plaintext passwords must never be stored.

**NFR-SEC-02: Authentication**\
All protected endpoints must require authentication.

**NFR-SEC-03: Authorization**\
The server must enforce role-based permissions. Hiding UI elements is
not sufficient authorization.

**NFR-SEC-04: GPS Trust Boundary**\
Client-provided GPS information must be validated and independently
processed by the server.

**NFR-SEC-05: Upload Ownership**\
Users must not be able to attach another user's uploaded image to their
attendance record.

**NFR-SEC-06: Private Photo Storage**\
Attendance photos must not be publicly accessible without authorization.

**NFR-SEC-07: Soft-Deleted Accounts**\
Soft-deleted users must not be able to authenticate or submit new
requests as active users.

**NFR-SEC-08: Auditability**\
Attendance attempts and corrections must retain the information required
to reconstruct relevant validation and modification events.

# 12. GPS Spoofing Mitigation and Limitations

The system aims to reduce attendance manipulation, not guarantee
complete prevention of GPS spoofing.

Possible mitigation signals include: - Suspiciously constant GPS
accuracy. - Unusual coordinate jumps. - Inconsistent location data. -
Approximate IP geolocation as an additional signal only.

IP geolocation must not be treated as authoritative proof of physical
location.

Browser-based systems cannot reliably detect every GPS spoofing method,
including all developer tools, simulated location providers, and virtual
device environments.

The system must not claim complete GPS spoofing immunity.

# 13. Non-Functional Requirements

## 13.1 Reliability

The system must prevent duplicate official attendance records even when
multiple requests are submitted concurrently.

## 13.2 Data Consistency

Attendance creation, photo reference consumption, and relevant database
updates must be handled consistently. If attendance creation fails, the
system must not leave a partially created official attendance record.

## 13.3 Maintainability

Business rules such as session status, GPS validation, and attendance
status calculation should be centralized rather than duplicated across
controllers or frontend components.

## 13.4 Configuration

Application timezone and other environment-dependent settings must be
centrally configurable. The application must not hardcode timezone
values across individual modules.

## 13.5 Privacy

Attendance photos must be stored privately and accessed only by
authorized users.

# 14. Testing Requirements

## 14.1 GPS Testing

Test location distances: - 5 meters. - 10 meters. - 15 meters. - 19
meters. - 21 meters. - 25 meters. - 30 meters.

Test environments: - Open area. - Building edge. - Indoor environment.

Test all three GPS policies.

## 14.2 GPS Manipulation Testing

Test representative scenarios involving: - Browser developer tools
location simulation. - Fake GPS applications. - Unusual accuracy
values. - Impossible coordinate changes.

Test results must distinguish detected cases from undetected cases.

## 14.3 Attendance Testing

Test: - Successful attendance. - Rejected GPS validation. - Submission
before and after the late threshold. - Submission after session
closing. - Duplicate attendance. - Manual session closing. - Concurrent
attendance requests.

## 14.4 Selfie Upload Testing

Test: - Successful image upload. - Invalid file type. - Oversized
file. - Upload failure. - Missing photo path. - Nonexistent photo
path. - Another user's photo path. - Reuse of an already-consumed
upload. - Successful upload followed by rejected attendance. - Cleanup
of expired unused uploads.

## 14.5 Soft Delete Testing

Test: - Soft-deleting a student. - Soft-deleting a lecturer. - Login
attempts using a soft-deleted account. - Historical attendance
visibility after student deletion. - Historical session visibility after
lecturer deletion. - Report generation containing soft-deleted users. -
Username and NIM uniqueness after deletion.

## 14.6 Evaluation Metrics

The research evaluation may calculate: - False Rejection Rate (FRR). -
False Acceptance Rate (FAR). - GPS distance error. - Mean Absolute
Percentage Error (MAPE), where appropriate.

# 15. Acceptance Criteria

The system is considered functionally acceptable when:

1.  Administrators can manage user accounts and rooms.
2.  Users can authenticate according to their roles.
3.  Soft-deleted users cannot authenticate.
4.  Historical records remain intact after user soft deletion.
5.  Lecturers can create and manage attendance sessions.
6.  Session availability follows server time.
7.  Students can submit attendance only during an open session.
8.  GPS validation is performed on both client and server.
9.  All rejected GPS attempts are logged.
10. Students must capture a selfie directly through the browser camera.
11. Selfie upload is performed separately from attendance submission.
12. The attendance endpoint accepts a validated `photo_path` rather than
    image binary data.
13. A successful attendance record always references a valid private
    selfie.
14. Duplicate attendance records are prevented.
15. Attendance status is calculated using server time.
16. Lecturers can correct existing attendance records with a mandatory
    reason.
17. Reports are available according to user roles.
18. Excel and PDF exports are supported.
19. Historical attendance and audit records remain accessible.

# 16. Implementation Guidelines for AI Coding Agents

1.  Treat this SRS as the primary functional and technical reference.
2.  Do not introduce features outside the defined scope without explicit
    approval.
3.  Implement backend authorization for every protected operation.
4.  Never trust client-side GPS validation as the final decision.
5.  Never trust arbitrary photo paths supplied by the client.
6.  Preserve historical records when soft-deleting users.
7.  Enforce the unique student-session attendance constraint at the
    database level.
8.  Use server time for all attendance and session-time decisions.
9.  Centralize GPS policy evaluation.
10. Keep attendance attempts and attendance corrections auditable.
11. Store attendance photos privately.
12. Ensure temporary upload cleanup cannot delete photos attached to
    official attendance records.
13. Do not implement facial recognition.
14. Do not claim that browser-based GPS validation completely prevents
    spoofing.
15. Keep implementation modular and maintainable.
