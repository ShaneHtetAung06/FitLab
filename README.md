# FitLab

**CSX 4107 · Term Project · Semester 2026_1**

A fitness course platform where **verified trainers sell structured programmes and students learn with real coaching.**

### Team

| Member              | Student ID | GitHub                                                       |
| ------------------- | ---------: | ------------------------------------------------------------ |
| **Shane Htet Aung** |    6740002 | [@ShaneHtetAung06](https://github.com/ShaneHtetAung06)       |
| **Aung Myint Myat** |    6746035 | [@aungmmyat111-debug](https://github.com/aungmmyat111-debug) |
| **Phone Nay Tun**   |    6747002 | [@PhoneNayTun](https://github.com/PhoneNayTun)               |

---

## Features

### Students

* Browse and discover fitness courses
* Purchase courses securely through **Stripe**
* Track lesson and course progress
* Review and rate completed courses
* Chat with trainers in real time

### Trainers

* Apply to become a verified trainer
* Submit credentials for admin review
* Create and manage structured courses
* Organize courses into sections and lessons
* Add video and written lesson content
* View course and platform analytics

### Admins

* Review and approve trainer applications
* Manage users and platform access
* Oversee trainer verification

---

## Tech Stack

| Category                    | Technology                        |
| --------------------------- | --------------------------------- |
| **Framework**               | Next.js 14 · App Router           |
| **Language**                | JavaScript / TypeScript           |
| **Database**                | MongoDB · Mongoose                |
| **Authentication**          | JWT · httpOnly Cookies · bcrypt   |
| **Payments**                | Stripe Checkout · Stripe Webhooks |
| **Real-time Communication** | Socket.IO                         |
| **File Uploads**            | Cloudinary                        |
| **Styling**                 | Tailwind CSS 3.4                  |

---

## Project Structure

```text
src/
├── app/
│   ├── (auth)/          # Authentication pages
│   ├── admin/           # Admin dashboard
│   ├── chat/            # Real-time messaging
│   ├── courses/         # Course catalogue & details
│   ├── dashboard/       # Student dashboard, profile & enrolments
│   ├── trainer/         # Trainer panel, analytics & course builder
│   └── api/             # REST API endpoints
│
├── components/          # Shared UI components
├── context/             # Authentication & Socket providers
├── hooks/               # Custom React hooks
├── lib/                 # Database, authentication & service helpers
└── models/              # Mongoose schemas
```

---

## User Roles

| Role         | Access                                           | How to Get It                       |
| ------------ | ------------------------------------------------ | ----------------------------------- |
| **Customer** | Browse, purchase, learn, chat & review           | Register an account                 |
| **Trainer**  | Customer features + create courses & analytics   | Apply → Admin approval              |
| **Admin**    | Trainer features + user & application management | Set `role: "admin"` in the database |

---

## Getting Started

### 1. Clone the Repository

```bash
git clone <repo-url>
cd fitlab
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the project root:

```env
MONGODB_URI=mongodb+srv://...

JWT_SECRET=your_secret
JWT_EXPIRES_IN=7d

STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

NEXT_PUBLIC_APP_URL=http://localhost:3000

CLOUDINARY_CLOUD_NAME=your_cloud
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud
```

> **Note:** Stripe configuration is optional for local development. Without Stripe keys, checkout is disabled while the rest of the platform remains available.

### 4. Run the Development Server

```bash
npm run dev
```

The application will be available at:

```text
http://localhost:3000
```

### 5. Production Build

Build the application:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

---



## Core Capabilities

* **Course Marketplace** — Discover and purchase structured fitness programmes.
* **Trainer Verification** — Trainers submit credentials before gaining publishing access.
* **Course Builder** — Trainers create courses with sections, lessons, videos and written content.
* **Learning Progress** — Students track their progress through enrolled courses.
* **Secure Payments** — Stripe Checkout handles course purchases, with webhooks used to confirm payments.
* **Real-Time Chat** — Students and trainers can communicate through Socket.IO.
* **Reviews & Ratings** — Students can review courses after learning from them.
* **Trainer Analytics** — Trainers can monitor course and platform performance.
* **Cloud Media Storage** — Course media is uploaded and managed through Cloudinary.

---


## ScreenShots

## License

**Private · All Rights Reserved**

This project is for academic purposes. Unauthorized copying, redistribution, or commercial use is not permitted.
