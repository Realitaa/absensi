# Entity Relationship Diagram (ERD)

## Web-Based Attendance System with GPS and Selfie Validation

**Document Status:** Logical Data Model\
**Related Document:** `SRS.md`

This document describes the logical database entities, attributes,
relationships, cardinalities, and important data-integrity rules for the
attendance system.

The ERD is maintained separately from the SRS so that functional
requirements and database design can evolve independently.

------------------------------------------------------------------------

# 1. Entities

## 1.1 users

Stores administrator, lecturer, and student accounts.

  -----------------------------------------------------------------------
  Attribute               Description             Constraint
  ----------------------- ----------------------- -----------------------
  id                      User identifier         Primary key

  name                    Full name               Required

  username                Login username          Unique across active
                                                  and soft-deleted users

  password                Password hash           Required

  role                    Admin, Lecturer, or     Required
                          Student                 

  nim                     Student identification  Unique for students;
                          number                  nullable for other
                                                  roles

  created_at              Creation timestamp      

  updated_at              Last update timestamp   

  deleted_at              Soft deletion timestamp Nullable
  -----------------------------------------------------------------------

Soft deletion is implemented by setting `deleted_at`. Historical
foreign-key references must remain valid.

## 1.2 rooms

Stores classroom locations and geofence configuration.

  Attribute    Description                 Constraint
  ------------ --------------------------- -------------------
  id           Room identifier             Primary key
  name         Room name                   Required
  latitude     Room latitude               Required
  longitude    Room longitude              Required
  radius       Geofence radius in meters   Maximum 20 meters
  created_at   Creation timestamp          
  updated_at   Last update timestamp       

## 1.3 sessions

Stores lecturer-created attendance sessions.

  Attribute            Description                   Constraint
  -------------------- ----------------------------- ------------------------
  id                   Session identifier            Primary key
  lecturer_id          Session owner                 Foreign key → users.id
  room_id              Associated room               Foreign key → rooms.id
  name                 Session name                  Required
  description          Session description           Optional
  starts_at            Session start timestamp       Required
  late_threshold_at    Late threshold timestamp      Required
  closes_at            Scheduled closing timestamp   Required
  manually_closed_at   Manual closing timestamp      Nullable
  created_at           Creation timestamp            
  updated_at           Last update timestamp         

Time constraint: `starts_at <= late_threshold_at < closes_at`.

## 1.4 attendances

Stores official attendance records.

  -----------------------------------------------------------------------
  Attribute               Description             Constraint
  ----------------------- ----------------------- -----------------------
  id                      Attendance identifier   Primary key

  student_id              Student reference       Foreign key → users.id

  session_id              Session reference       Foreign key →
                                                  sessions.id

  status                  Present, Late, Excused, Required
                          or Sick                 

  attendance_timestamp    Server timestamp        Required

  latitude                Submitted latitude      Required for successful
                                                  GPS validation

  longitude               Submitted longitude     Required for successful
                                                  GPS validation

  accuracy                GPS accuracy in meters  Required for successful
                                                  GPS validation

  calculated_distance     Calculated distance in  Required
                          meters                  

  validation_policy       K1, K2, or K3           Required

  photo_path              Private selfie storage  Required
                          path                    

  created_at              Creation timestamp      

  updated_at              Last update timestamp   
  -----------------------------------------------------------------------

A unique constraint must exist on `(student_id, session_id)`.

## 1.5 attendance_attempts

Stores all attendance attempts, including rejected attempts.

  -----------------------------------------------------------------------
  Attribute               Description             Constraint
  ----------------------- ----------------------- -----------------------
  id                      Attempt identifier      Primary key

  student_id              Student reference       Foreign key → users.id

  session_id              Session reference       Foreign key →
                                                  sessions.id

  room_id                 Room reference          Foreign key → rooms.id

  latitude                Attempt latitude        Nullable

  longitude               Attempt longitude       Nullable

  accuracy                GPS accuracy            Nullable

  calculated_distance     Calculated distance     Nullable

  validation_policy       Applied GPS policy      Required when policy
                                                  evaluation occurs

  result                  Accepted or Rejected    Required

  rejection_reason        Rejection reason        Nullable

  attempted_at            Server-side attempt     Required
                          timestamp               

  attendance_id           Associated official     Nullable foreign key →
                          attendance              attendances.id

  created_at              Creation timestamp      
  -----------------------------------------------------------------------

GPS acquisition failures must also be representable even when
coordinates are unavailable.

## 1.6 attendance_corrections

Stores the audit history of lecturer attendance corrections.

  Attribute         Description                  Constraint
  ----------------- ---------------------------- ------------------------------
  id                Correction identifier        Primary key
  attendance_id     Corrected attendance         Foreign key → attendances.id
  lecturer_id       User performing correction   Foreign key → users.id
  previous_status   Previous attendance status   Required
  new_status        New attendance status        Required
  reason            Correction reason            Required
  corrected_at      Correction timestamp         Required
  created_at        Creation timestamp           

## 1.7 system_settings

Stores global system configuration relevant to attendance validation.

  Attribute               Description                        Constraint
  ----------------------- ---------------------------------- -------------
  id                      Settings identifier                Primary key
  gps_validation_policy   Active GPS policy: K1, K2, or K3   Required
  updated_at              Last update timestamp              

Only one active global GPS validation policy is used.

## 1.8 photo_uploads

Stores metadata about selfie uploads before and after attachment to
attendance records.

  -----------------------------------------------------------------------
  Attribute               Description             Constraint
  ----------------------- ----------------------- -----------------------
  id                      Upload metadata         Primary key
                          identifier              

  user_id                 Authenticated uploader  Foreign key → users.id

  photo_path              Server-generated        Required
                          private storage path    

  status                  Pending, Consumed, or   Required
                          Expired                 

  uploaded_at             Upload timestamp        Required

  consumed_at             Consumption timestamp   Nullable

  attendance_id           Associated attendance   Nullable foreign key →
                                                  attendances.id
  -----------------------------------------------------------------------

The `photo_path` is the actual server-generated storage reference. An
opaque upload ID is not required by the system specification.

The application must verify that a submitted path exists in upload
metadata, belongs to the authenticated user, and has not already been
consumed. The server must not treat arbitrary client-provided paths as
trusted filesystem paths.

------------------------------------------------------------------------

# 2. Relationships and Cardinalities

  ------------------------------------------------------------------------
  Relationship             Cardinality             Description
  ------------------------ ----------------------- -----------------------
  users → sessions         1 to many               One lecturer can create
                                                   multiple sessions.

  rooms → sessions         1 to many               One room can be used by
                                                   multiple sessions over
                                                   time.

  users → attendances      1 to many               One student can have
                                                   multiple attendance
                                                   records.

  sessions → attendances   1 to many               One session can contain
                                                   multiple student
                                                   attendance records.

  users →                  1 to many               One student can make
  attendance_attempts                              multiple attendance
                                                   attempts.

  sessions →               1 to many               One session can have
  attendance_attempts                              multiple attempts.

  rooms →                  1 to many               One room can be
  attendance_attempts                              referenced by multiple
                                                   attempts.

  attendances →            1 to many               One attendance record
  attendance_corrections                           can have multiple
                                                   corrections.

  users →                  1 to many               One lecturer can
  attendance_corrections                           perform multiple
                                                   corrections.

  users → photo_uploads    1 to many               One user can upload
                                                   multiple selfies.

  attendances →            0 to 1 per upload       An upload may be
  photo_uploads                                    unconsumed or attached
                                                   to one attendance.
  ------------------------------------------------------------------------

------------------------------------------------------------------------

# 3. ER Diagram

``` mermaid
erDiagram
    USERS ||--o{ SESSIONS : creates
    ROOMS ||--o{ SESSIONS : hosts

    USERS ||--o{ ATTENDANCES : submits
    SESSIONS ||--o{ ATTENDANCES : contains

    USERS ||--o{ ATTENDANCE_ATTEMPTS : makes
    SESSIONS ||--o{ ATTENDANCE_ATTEMPTS : receives
    ROOMS ||--o{ ATTENDANCE_ATTEMPTS : references
    ATTENDANCES o|--o{ ATTENDANCE_ATTEMPTS : results_in

    ATTENDANCES ||--o{ ATTENDANCE_CORRECTIONS : has
    USERS ||--o{ ATTENDANCE_CORRECTIONS : performs

    USERS ||--o{ PHOTO_UPLOADS : uploads
    ATTENDANCES o|--o{ PHOTO_UPLOADS : consumes

    USERS {
        bigint id PK
        string name
        string username UK
        string password
        string role
        string nim UK
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }

    ROOMS {
        bigint id PK
        string name
        decimal latitude
        decimal longitude
        decimal radius
        timestamp created_at
        timestamp updated_at
    }

    SESSIONS {
        bigint id PK
        bigint lecturer_id FK
        bigint room_id FK
        string name
        text description
        timestamp starts_at
        timestamp late_threshold_at
        timestamp closes_at
        timestamp manually_closed_at
        timestamp created_at
        timestamp updated_at
    }

    ATTENDANCES {
        bigint id PK
        bigint student_id FK
        bigint session_id FK
        string status
        timestamp attendance_timestamp
        decimal latitude
        decimal longitude
        decimal accuracy
        decimal calculated_distance
        string validation_policy
        string photo_path
        timestamp created_at
        timestamp updated_at
    }

    ATTENDANCE_ATTEMPTS {
        bigint id PK
        bigint student_id FK
        bigint session_id FK
        bigint room_id FK
        decimal latitude
        decimal longitude
        decimal accuracy
        decimal calculated_distance
        string validation_policy
        string result
        string rejection_reason
        timestamp attempted_at
        bigint attendance_id FK
        timestamp created_at
    }

    ATTENDANCE_CORRECTIONS {
        bigint id PK
        bigint attendance_id FK
        bigint lecturer_id FK
        string previous_status
        string new_status
        text reason
        timestamp corrected_at
        timestamp created_at
    }

    SYSTEM_SETTINGS {
        bigint id PK
        string gps_validation_policy
        timestamp updated_at
    }

    PHOTO_UPLOADS {
        bigint id PK
        bigint user_id FK
        string photo_path
        string status
        timestamp uploaded_at
        timestamp consumed_at
        bigint attendance_id FK
    }
```

------------------------------------------------------------------------

# 4. Data Integrity Rules

## 4.1 User Soft Deletion

-   User deletion updates `deleted_at`; it does not physically remove
    the user row.
-   Historical foreign keys referencing the user must remain valid.
-   Soft-deleted users cannot authenticate.
-   Usernames and student NIM values remain reserved.
-   User deletion must not cascade-delete sessions, attendances,
    attempts, corrections, or photo references.

## 4.2 Session and Room Retention

-   A session containing attendance records must not be permanently
    deleted.
-   A room referenced by historical sessions must not be physically
    deleted in a way that breaks historical references.
-   A lecturer's soft deletion must not remove sessions owned by that
    lecturer.

## 4.3 Attendance Integrity

-   `(student_id, session_id)` must be unique.
-   Attendance creation must be atomic with the successful
    consumption/attachment of the selfie upload.
-   Attendance records must reference valid private selfie paths.
-   Rejected attempts must not create official attendance records.

## 4.4 Photo Upload Lifecycle

-   Newly uploaded photos begin in `Pending` state.
-   A successful attendance submission changes the upload to `Consumed`
    and associates it with the attendance record.
-   An unused upload may become `Expired` and be removed by cleanup.
-   Cleanup must not delete a photo referenced by an official attendance
    record.
-   A photo upload must belong to the user who submits the attendance
    request.
-   One upload may be consumed by at most one attendance record.

## 4.5 Referential Integrity

Foreign-key deletion behavior must preserve historical data.

Use restrictive deletion behavior or equivalent application-level
safeguards where deleting a referenced row would break historical
records. Do not use cascading physical deletion for historical
attendance data.

------------------------------------------------------------------------

# 5. Implementation Notes

1.  This is a logical ERD, not a finalized physical schema.
2.  Exact SQL data types, indexes, foreign-key names, and migration
    ordering must be determined during implementation.
3.  The `users` table must support soft deletion.
4.  The database must enforce the unique student-session attendance
    constraint.
5.  `photo_path` is a server-generated storage path, not an arbitrary
    filesystem path accepted from the client.
6.  The system uses one global GPS validation policy at a time.
7.  The application timezone is configured separately through
    `APP_TIMEZONE`; it is not a database entity in this ERD.
8.  The `system_settings` table may be extended for other
    database-backed global settings if explicitly required.
