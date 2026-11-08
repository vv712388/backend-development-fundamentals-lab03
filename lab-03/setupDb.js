const sqlite3 = require("sqlite3").verbose();
const { open } = require("sqlite");
const path = require("path");

const initializeDatabase = async () => {
  const db = await open({
    filename: path.join(__dirname, "books.db"),
    driver: sqlite3.Database
  });

  await db.exec("DROP TABLE IF EXISTS book");
  await db.exec(`
    CREATE TABLE book (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      price INTEGER NOT NULL,
      pages INTEGER NOT NULL
    )
  `);

  const books = [
    ["The Alchemist", "Paulo Coelho", 350, 208],
    ["The Great Gatsby", "F. Scott Fitzgerald", 420, 180],
    ["Wings of Fire", "A. P. J. Abdul Kalam", 280, 180],
    ["The Hobbit", "J. R. R. Tolkien", 550, 310],
    ["Atomic Habits", "James Clear", 499, 320],
    ["Clean Code", "Robert C. Martin", 650, 464],
    ["The Power of Now", "Eckhart Tolle", 399, 236],
    ["Deep Work", "Cal Newport", 450, 296],
    ["Introduction to Algorithms", "Thomas H. Cormen", 900, 1312],
    ["The Pragmatic Programmer", "Andrew Hunt", 600, 352]
  ];

  const insert = await db.prepare(
    "INSERT INTO book (title, author, price, pages) VALUES (?, ?, ?, ?)"
  );

  try {
    for (const book of books) {
      await insert.run(book);
    }
  } finally {
    await insert.finalize();
    await db.close();
  }

  process.stdout.write("Database initialized and 10 books inserted successfully.\n");
};

initializeDatabase().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
