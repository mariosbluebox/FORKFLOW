# ForkFlow

ForkFlow is a restaurant analytics and decision-support platform built to turn day-to-day operational and financial data into clear, actionable business insights.

The project combines real hospitality domain knowledge with data modelling, analytics, and modern web development. It is designed around the information restaurant operators actually work with: revenue, expenses, payroll, inventory, delivery platforms, promotions, and operating costs.

## What ForkFlow does

ForkFlow brings core restaurant data into one system so performance can be analysed across multiple parts of the business.

Current data domains include:

- Revenue by source
- Expenses and expense categories
- Payroll and labour costs
- Inventory and stock movements
- Ingredient usage and wastage
- Menu items and food-cost targets
- Delivery channels such as Uber Eats, Deliveroo, and Just Eat
- Platform commissions and promotions
- Overhead allocation
- Operational reporting

## Analytics

ForkFlow includes a dedicated analytics layer focused on decision support rather than simple record keeping.

Current analytics models include:

- **Channel expectancy** — evaluates performance per order across sales channels
- **Promotion expectancy** — evaluates the return associated with promotional spend
- **Labour expectancy** — measures performance relative to labour hours
- **Ingredient expectancy** — evaluates performance relative to ingredient cost
- **Win rate, average win, average loss, and expectancy metrics**
- **Correlation storage** for relationships between operating variables

The goal is to help answer practical questions such as:

- Which sales channels are actually contributing positively?
- Are promotions generating enough value to justify their cost?
- How efficiently is labour being converted into business performance?
- How are ingredient costs and wastage affecting results?
- Where are operational costs reducing profitability?

## Tech stack

- **Next.js 15**
- **React 19**
- **TypeScript**
- **PostgreSQL**
- **Prisma ORM**
- **Recharts**
- **NextAuth**
- **Stripe**
- **Tailwind CSS**
- **Git / GitHub**

## Architecture

ForkFlow uses a full-stack Next.js architecture with React and TypeScript powering the user interface, dashboards, and application workflows.

Operational and financial data is stored in PostgreSQL, with Prisma providing the schema, relationships, migrations, and application-level database access.

The analytics flow follows a simple pipeline:

**Business data → PostgreSQL → Prisma/data logic → analytical calculations → dashboards and decision-support views**

The main business domains are revenue, expenses, payroll, inventory, stock movements, menu items, delivery platforms, promotions, overhead allocation, and analytical snapshots such as expectancy and correlation results.

This keeps the operational data model, analytical logic, and presentation layer clearly connected while allowing each area to evolve independently.

## Data model

The PostgreSQL data model is designed around real restaurant operations.

Core entities include:

- Restaurants and users
- Revenue entries
- Expense categories and expenses
- Employees and payroll
- Inventory items and stock movements
- Menu items
- Delivery platforms and reporting periods
- Promotion charges
- Overhead allocation settings
- Correlation results
- Expectancy snapshots

Prisma is used for schema definition, relationships, migrations, and database access.

## Why I built it

My background is in hospitality and restaurant operations, where I worked directly with food costs, stock control, ordering, wastage, staffing, suppliers, menu costing, margins, and production planning.

ForkFlow grew from a simple question:

> How can restaurant operating data be turned into information that helps an owner make better decisions?

The project is also part of my transition into data analytics and data science, allowing me to combine domain knowledge with data modelling, analytical reasoning, database design, and software development.

## Project status

ForkFlow is under active development.

The current application includes operational modules for revenue, expenses, payroll, inventory, platforms, reporting, and analytics. Additional analytical features and portfolio documentation are being developed as the project evolves.

## Local development

### Requirements

- Node.js
- PostgreSQL
- npm

### Setup

```bash
git clone https://github.com/mariosbluebox/FORKFLOW.git
cd FORKFLOW
npm install
```

Create the required environment variables, including a PostgreSQL `DATABASE_URL`, then run Prisma migrations and start the application:

```bash
npx prisma migrate dev
npm run dev
```

Open `http://localhost:3000` in your browser.

## Portfolio focus

ForkFlow demonstrates practical experience with:

- Data analysis
- PostgreSQL
- Relational data modelling
- Business and financial analytics
- Data visualisation
- TypeScript
- Full-stack application development
- Translating domain knowledge into analytical software
