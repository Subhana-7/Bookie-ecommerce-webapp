<div align="center">

# 📚 Bookie — Online Bookstore E-Commerce Platform |  [Live Link](https://bookieshop.online/)

A full-stack e-commerce web application for buying and selling books, built with **Node.js**, **Express**, **MongoDB**, and **EJS**. Bookie includes a complete customer shopping experience alongside a full-featured admin dashboard for catalog, order, and sales management.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-8.x-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![EJS](https://img.shields.io/badge/EJS-3.x-B4CA65?logo=ejs&logoColor=white)](https://ejs.co/)
[![License](https://img.shields.io/badge/License-ISC-blue.svg)](#license)

</div>

---

## Table of Contents

- [About](#about)
- [Features](#features)
  - [Customer](#customer-features)
  - [Admin](#admin-features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Running the App](#running-the-app)
- [Available Scripts](#available-scripts)
- [Application Routes](#application-routes)
- [Roadmap](#roadmap)
- [Contact](#contact)

---

## About

**Bookie** is a full-stack MVC e-commerce application that simulates a real-world online bookstore. It supports customer-facing shopping features (browsing, cart, wishlist, checkout, payments, order tracking) as well as an admin panel for managing products, categories, orders, coupons, and sales analytics.

This project was built as a hands-on implementation of core e-commerce concepts: authentication (local + Google OAuth), server-side rendering with EJS, secure payment processing with Razorpay, transactional email via Nodemailer, and PDF/Excel report generation.

## Features

### Customer Features

- 🔐 **Authentication** — Email/password signup with OTP verification, login, and Google OAuth 2.0 sign-in
- 🔑 **Password Recovery** — OTP-based password reset flow
- 📖 **Product Browsing** — Product listing and detail pages with category-based offers
- 🛒 **Shopping Cart** — Add, update, and remove items with live cart item count
- ❤️ **Wishlist** — Save products for later
- 📍 **Address Management** — Add, edit, and delete multiple delivery addresses
- 💳 **Checkout & Payments** — Razorpay integration with payment verification and retry-on-failure support
- 📦 **Order Management** — Track orders, cancel/return full orders or individual items, and download PDF invoices
- 🎟️ **Coupons** — Apply discount coupons at checkout
- 👛 **Wallet** — Wallet balance for refunds and repayments
- 🤖 **AI Chat Support** — In-app chatbot widget (Rasa-compatible webhook integration)
- 👤 **Profile Management** — Edit personal details and manage saved addresses

### Admin Features

- 📊 **Dashboard** — Real-time sales and performance overview
- 👥 **User Management** — View, block, and unblock customer accounts
- 🗂️ **Category Management** — Create, edit, list/unlist categories, and apply category-level offers
- 📚 **Product Management** — Add/edit products with multi-image upload (Multer + Sharp), product-level offers, and block/unblock/delete controls
- 📦 **Order Management** — View order details, update order status, and manage return/cancellation requests per item
- 🎟️ **Coupon Management** — Full CRUD for discount coupons
- 📈 **Sales Reports** — Generate and download sales reports (PDF via PDFKit, Excel via ExcelJS)

## Tech Stack

| Layer                | Technology                                                        |
|-----------------------|--------------------------------------------------------------------|
| **Frontend**          | EJS (server-side templating), Bootstrap, SCSS                     |
| **Backend**            | Node.js, Express.js                                                |
| **Database**           | MongoDB with Mongoose ODM                                          |
| **Authentication**     | Passport.js (Google OAuth 2.0), bcrypt, express-session            |
| **Payments**           | Razorpay                                                            |
| **Email**              | Nodemailer (Gmail SMTP), Resend                                    |
| **File Uploads**       | Multer, Sharp (image processing)                                   |
| **Reports**            | PDFKit (invoices), ExcelJS (sales reports)                         |
| **Utilities**          | Moment.js, UUID, dotenv, connect-flash                             |

## Project Structure

```
Bookie-ecommerce-webapp/
├── app.js                     # Application entry point
├── config/
│   ├── db.js                  # MongoDB connection
│   ├── passport.js            # Google OAuth strategy
│   └── emailConfig.js         # Nodemailer transporter
├── controllers/
│   ├── admin/                 # Admin route handlers (dashboard, products, orders, etc.)
│   └── user/                  # Customer route handlers (auth, cart, orders, etc.)
├── helpers/
│   └── multer.js              # File upload storage configuration
├── middlewares/
│   └── auth.js                # userAuth / adminAuth route guards
├── models/                    # Mongoose schemas (User, Product, Order, Cart, etc.)
├── public/                    # Static assets (CSS, JS, fonts, images, uploads)
├── routes/
│   ├── userRouter.js          # Customer-facing routes
│   └── adminRouter.js         # Admin panel routes
└── views/
    ├── user/                  # Customer-facing EJS views
    ├── admin/                 # Admin panel EJS views
    └── partials/              # Shared EJS partials (header, footer, etc.)
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- [MongoDB](https://www.mongodb.com/) (local instance or a hosted cluster, e.g. MongoDB Atlas)
- A [Razorpay](https://razorpay.com/) account for payment credentials
- A [Google Cloud](https://console.cloud.google.com/) project with OAuth 2.0 credentials (for Google Sign-In)
- A Gmail account with an [App Password](https://support.google.com/accounts/answer/185833) (for transactional emails)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/Subhana-7/Bookie-ecommerce-webapp.git
   cd Bookie-ecommerce-webapp
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   Create a `.env` file in the project root (see [Environment Variables](#environment-variables) below).

### Environment Variables

Create a `.env` file in the root directory with the following keys:

```env
# Server
PORT=7000

# Database
MONGODB_URI=your_mongodb_connection_string

# Session
SESSION_SECRET=your_session_secret

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK=http://localhost:7000/auth/google/callback

# Email (Nodemailer - Gmail)
EMAIL_USER=your_gmail_address
EMAIL_PASSWORD=your_gmail_app_password

# Razorpay
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

> ⚠️ **Never commit your `.env` file.** It is already excluded via `.gitignore`.

### Running the App

```bash
# Development (with auto-restart via nodemon)
npx nodemon app.js

# Production
npm start
```

The app will be available at **http://localhost:7000**.

## Available Scripts

| Command       | Description                          |
|---------------|---------------------------------------|
| `npm start`   | Starts the server with Node.js       |

> 💡 Consider adding a `"dev": "nodemon app.js"` script to `package.json` for a smoother local development workflow.

## Application Routes

<details>
<summary><strong>Customer routes</strong> (prefix: <code>/</code>)</summary>

| Method | Route | Description |
|--------|-------|-------------|
| GET/POST | `/signup`, `/verify-otp`, `/resend-otp` | Registration with OTP verification |
| GET/POST | `/login`, `/logout` | Authentication |
| GET | `/auth/google`, `/auth/google/callback` | Google OAuth login |
| GET/POST | `/reset-password` | Password recovery via OTP |
| GET | `/products`, `/product-details/:id` | Product catalog |
| GET/POST | `/cart/*` | Cart operations |
| GET/POST | `/wishlist/*` | Wishlist operations |
| GET/POST | `/order`, `/payment`, `/verify-razorpay-payment` | Checkout & payment |
| GET/POST | `/orders-list`, `/order-details/:orderId`, `/cancel-order/:orderId`, `/return-order/:orderId` | Order tracking |
| GET | `/wallet` | Wallet balance |
| GET | `/download-invoice/:id` | PDF invoice download |
| GET/POST | `/chat` | AI chatbot |

</details>

<details>
<summary><strong>Admin routes</strong> (prefix: <code>/admin</code>)</summary>

| Method | Route | Description |
|--------|-------|-------------|
| GET/POST | `/admin/login`, `/admin/logout` | Admin authentication |
| GET | `/admin/dashboard`, `/admin/dashboard-data` | Analytics dashboard |
| GET | `/admin/users`, `/admin/block-user`, `/admin/unblock-user` | Customer management |
| GET/POST | `/admin/category`, `/admin/add-category`, `/admin/edit-category/:id` | Category management |
| GET/POST | `/admin/add-product`, `/admin/edit-product/:id`, `/admin/productManagement` | Product management |
| GET/POST | `/admin/order-management`, `/admin/admin-order-details/:orderId` | Order management |
| GET/POST | `/admin/coupon-management`, `/admin/create-coupon`, `/admin/edit-coupon/:id` | Coupon management |
| GET | `/admin/sales-report`, `/admin/generate-report`, `/admin/download-report` | Sales reporting |

</details>

## Roadmap

- [ ] Add automated tests (unit/integration)
- [ ] Add a `.env.example` file for easier onboarding
- [ ] Add CI pipeline (lint + test on PR)
- [ ] API rate limiting and input validation middleware
- [ ] Dockerize the application for one-command setup

## Contact

**Subhana** — [GitHub Profile](https://github.com/Subhana-7)

Project Link: [https://github.com/Subhana-7/Bookie-ecommerce-webapp](https://github.com/Subhana-7/Bookie-ecommerce-webapp)

Linkedin — [Linkedin Profile](https://www.linkedin.com/in/subhana-sn-4b4b50307/)
