const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./data/rss_reader.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    return;
  }
  console.log('Connected to SQLite database.');
  
  // Run all setup operations in sequence
  db.serialize(() => {
    // Create feeds table
    db.run(`CREATE TABLE IF NOT EXISTS feeds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT UNIQUE NOT NULL,
      title TEXT,
      description TEXT,
      homepage_url TEXT,
      last_fetched DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) console.error('Error creating feeds table:', err.message);
      else console.log('Feeds table created/verified.');
    });

    // Create articles table
    db.run(`CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feed_id INTEGER,
      title TEXT NOT NULL,
      link TEXT UNIQUE NOT NULL,
      description TEXT,
      pub_date DATETIME,
      guid TEXT,
      is_read BOOLEAN DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (feed_id) REFERENCES feeds (id) ON DELETE CASCADE
    )`, (err) => {
      if (err) console.error('Error creating articles table:', err.message);
      else console.log('Articles table created/verified.');
    });

    // Create indexes for better performance
    db.run(`CREATE INDEX IF NOT EXISTS idx_articles_read ON articles (is_read)`, (err) => {
      if (err) console.error('Error creating read index:', err.message);
    });
    
    db.run(`CREATE INDEX IF NOT EXISTS idx_articles_feed ON articles (feed_id)`, (err) => {
      if (err) console.error('Error creating feed index:', err.message);
    });
    
    db.run(`CREATE INDEX IF NOT EXISTS idx_articles_date ON articles (pub_date DESC)`, (err) => {
      if (err) console.error('Error creating date index:', err.message);
      else console.log('All indexes created/verified.');
    });

    // Close database after all operations complete
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      } else {
        console.log('Database setup complete. Tables created successfully.');
      }
    });
  });
});