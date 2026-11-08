const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const { open } = require("sqlite");
const path = require("path");

const app = express();
app.use(express.json());

let db;

const allowedOrderColumns = ["id", "title", "author", "price", "pages"];

const sendError = (res, status, message) => res.status(status).json({ message });

const validateBook = (body) => {
  if (!body || typeof body !== "object") return "Request body is required";
  if (typeof body.title !== "string" || body.title.trim() === "") return "Title is required";
  if (typeof body.author !== "string" || body.author.trim() === "") return "Author is required";
  if (body.price === undefined || body.price === null || body.price === "" || !Number.isFinite(Number(body.price)) || Number(body.price) < 0) return "Price must be a non-negative number";
  if (body.pages === undefined || body.pages === null || body.pages === "" || !Number.isInteger(Number(body.pages)) || Number(body.pages) <= 0) return "Pages must be a positive integer";
  return null;
};

app.get("/books", async (req, res) => {
  try {
    const searchQ = String(req.query.search_q || "").trim();
    const orderBy = String(req.query.order_by || "id").toLowerCase();
    const order = String(req.query.order || "ASC").toUpperCase();
    const limit = Number(req.query.limit === undefined ? 10 : req.query.limit);
    const offset = Number(req.query.offset === undefined ? 0 : req.query.offset);
    const minPrice = req.query.min_price === undefined ? null : Number(req.query.min_price);
    const maxPrice = req.query.max_price === undefined ? null : Number(req.query.max_price);

    if (!allowedOrderColumns.includes(orderBy)) return sendError(res, 400, "Invalid order_by value");
    if (!["ASC", "DESC"].includes(order)) return sendError(res, 400, "order must be ASC or DESC");
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) return sendError(res, 400, "limit must be an integer between 1 and 100");
    if (!Number.isInteger(offset) || offset < 0) return sendError(res, 400, "offset must be a non-negative integer");
    if ((minPrice !== null && (!Number.isFinite(minPrice) || minPrice < 0)) || (maxPrice !== null && (!Number.isFinite(maxPrice) || maxPrice < 0))) return sendError(res, 400, "Price filters must be non-negative numbers");
    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) return sendError(res, 400, "min_price cannot exceed max_price");

    let sql = "SELECT id, title, author, price, pages FROM book WHERE 1 = 1";
    const params = [];

    if (searchQ) {
      sql += " AND title LIKE ?";
      params.push(`%${searchQ}%`);
    }

    if (minPrice !== null && maxPrice !== null) {
      sql += " AND price BETWEEN ? AND ?";
      params.push(minPrice, maxPrice);
    } else if (minPrice !== null) {
      sql += " AND price >= ?";
      params.push(minPrice);
    } else if (maxPrice !== null) {
      sql += " AND price <= ?";
      params.push(maxPrice);
    }

    sql += ` ORDER BY ${orderBy} ${order} LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const books = await db.all(sql, params);
    return res.status(200).json({ message: "Books Retrieved Successfully", books });
  } catch (error) {
    return sendError(res, 500, "Internal Server Error");
  }
});

app.get("/books/:bookId", async (req, res) => {
  try {
    const bookId = Number(req.params.bookId);
    if (!Number.isInteger(bookId) || bookId <= 0) return sendError(res, 400, "Invalid Book ID");
    const book = await db.get("SELECT id, title, author, price, pages FROM book WHERE id = ?", [bookId]);
    if (!book) return sendError(res, 404, "Book Not Found");
    return res.status(200).json({ message: "Book Retrieved Successfully", book });
  } catch (error) {
    return sendError(res, 500, "Internal Server Error");
  }
});

app.post("/books", async (req, res) => {
  const validationError = validateBook(req.body);
  if (validationError) return sendError(res, 400, validationError);

  try {
    const result = await db.run(
      "INSERT INTO book (title, author, price, pages) VALUES (?, ?, ?, ?)",
      [req.body.title.trim(), req.body.author.trim(), Number(req.body.price), Number(req.body.pages)]
    );
    return res.status(201).json({ bookId: result.lastID, message: "Book Added Successfully" });
  } catch (error) {
    return sendError(res, 500, "Internal Server Error");
  }
});

app.put("/books/:bookId", async (req, res) => {
  const bookId = Number(req.params.bookId);
  if (!Number.isInteger(bookId) || bookId <= 0) return sendError(res, 400, "Invalid Book ID");
  const validationError = validateBook(req.body);
  if (validationError) return sendError(res, 400, validationError);

  try {
    const existingBook = await db.get("SELECT id FROM book WHERE id = ?", [bookId]);
    if (!existingBook) return sendError(res, 404, "Book Not Found");

    await db.run(
      "UPDATE book SET title = ?, author = ?, price = ?, pages = ? WHERE id = ?",
      [req.body.title.trim(), req.body.author.trim(), Number(req.body.price), Number(req.body.pages), bookId]
    );
    return res.status(200).json({ message: "Book Updated Successfully" });
  } catch (error) {
    return sendError(res, 500, "Internal Server Error");
  }
});

app.delete("/books/:bookId", async (req, res) => {
  const bookId = Number(req.params.bookId);
  if (!Number.isInteger(bookId) || bookId <= 0) return sendError(res, 400, "Invalid Book ID");

  try {
    const existingBook = await db.get("SELECT id FROM book WHERE id = ?", [bookId]);
    if (!existingBook) return sendError(res, 404, "Book Not Found");
    await db.run("DELETE FROM book WHERE id = ?", [bookId]);
    return res.status(200).json({ message: "Book Deleted Successfully" });
  } catch (error) {
    return sendError(res, 500, "Internal Server Error");
  }
});

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: path.join(__dirname, "books.db"),
      driver: sqlite3.Database
    });
    await db.exec("PRAGMA foreign_keys = ON");
    app.listen(3000, () => {
      process.stdout.write("Server running at http://localhost:3000\n");
    });
  } catch (error) {
    process.stderr.write(`Database or server initialization failed: ${error.message}\n`);
    process.exit(1);
  }
};

initializeDBAndServer();
