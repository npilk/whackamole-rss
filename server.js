const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const Parser = require('rss-parser');
const cron = require('node-cron');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 2999;
const parser = new Parser();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Database connection
const db = new sqlite3.Database('./data/rss_reader.db', (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
  }
});

// Routes
app.get('/', async (req, res) => {
  try {
    const unreadArticles = await getUnreadArticles();
    res.render('index', { articles: unreadArticles, view: 'unread' });
  } catch (error) {
    console.error('Error fetching unread articles:', error);
    res.status(500).send('Error loading articles');
  }
});

app.get('/archive', async (req, res) => {
  try {
    const allArticles = await getAllArticles();
    res.render('index', { articles: allArticles, view: 'archive' });
  } catch (error) {
    console.error('Error fetching all articles:', error);
    res.status(500).send('Error loading archive');
  }
});

app.get('/feeds', async (req, res) => {
  try {
    const feeds = await getFeeds();
    res.render('feeds', { feeds });
  } catch (error) {
    console.error('Error fetching feeds:', error);
    res.status(500).send('Error loading feeds');
  }
});

app.post('/feeds', async (req, res) => {
  const { url } = req.body;
  try {
    await addFeed(url);
    res.redirect('/feeds');
  } catch (error) {
    console.error('Error adding feed:', error);
    res.status(500).send('Error adding feed');
  }
});

app.post('/articles/:id/read', async (req, res) => {
  const { id } = req.params;
  try {
    await markAsRead(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking as read:', error);
    res.status(500).json({ error: 'Error marking as read' });
  }
});

app.delete('/feeds/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await deleteFeed(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting feed:', error);
    res.status(500).json({ error: 'Error deleting feed' });
  }
});

app.post('/articles/mark-all-read', async (req, res) => {
  try {
    await markAllAsRead();
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all as read:', error);
    res.status(500).json({ error: 'Error marking all as read' });
  }
});

// Database helper functions
function getUnreadArticles() {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT a.*, f.title as feed_title, f.homepage_url as feed_homepage
      FROM articles a
      JOIN feeds f ON a.feed_id = f.id
      WHERE a.is_read = FALSE
      ORDER BY
        COALESCE(a.pub_date, a.created_at) DESC,
        a.id DESC
    `;
    db.all(query, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getAllArticles() {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT a.*, f.title as feed_title, f.homepage_url as feed_homepage
      FROM articles a
      JOIN feeds f ON a.feed_id = f.id
      ORDER BY
        COALESCE(a.pub_date, a.created_at) DESC,
        a.id DESC
      LIMIT 500
    `;
    db.all(query, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getFeeds() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM feeds ORDER BY title', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function addFeed(url) {
  return new Promise(async (resolve, reject) => {
    try {
      const feed = await parser.parseURL(url);

      // Extract homepage URL from feed data
      let homepageUrl = feed.link || '';
      if (!homepageUrl && feed.feedUrl) {
        // Fallback: derive homepage from feed URL
        try {
          const feedUrlObj = new URL(feed.feedUrl);
          homepageUrl = `${feedUrlObj.protocol}//${feedUrlObj.hostname}`;
        } catch (e) {
          homepageUrl = '';
        }
      }
      if (!homepageUrl && url) {
        // Last fallback: derive homepage from RSS URL
        try {
          const urlObj = new URL(url);
          homepageUrl = `${urlObj.protocol}//${urlObj.hostname}`;
        } catch (e) {
          homepageUrl = '';
        }
      }

      const stmt = db.prepare('INSERT INTO feeds (url, title, description, homepage_url) VALUES (?, ?, ?, ?)');
      stmt.run([url, feed.title, feed.description, homepageUrl], function(err) {
        if (err) reject(err);
        else {
          fetchFeedArticles(this.lastID, url, true); // true = mark as read initially
          resolve(this.lastID);
        }
      });
      stmt.finalize();
    } catch (error) {
      reject(error);
    }
  });
}

function markAsRead(articleId) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE articles SET is_read = TRUE WHERE id = ?', [articleId], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function markAllAsRead() {
  return new Promise((resolve, reject) => {
    db.run('UPDATE articles SET is_read = TRUE WHERE is_read = FALSE', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function deleteFeed(feedId) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM feeds WHERE id = ?', [feedId], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function fetchFeedArticles(feedId, feedUrl, markAsReadInitially = false) {
  try {
    const feed = await parser.parseURL(feedUrl);

    // Check if feed needs homepage URL populated
    const feedData = await new Promise((resolve, reject) => {
      db.get('SELECT homepage_url FROM feeds WHERE id = ?', [feedId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    // If homepage_url is missing or empty, populate it
    if (!feedData.homepage_url) {
      let homepageUrl = feed.link || '';
      if (!homepageUrl && feed.feedUrl) {
        // Fallback: derive homepage from feed URL
        try {
          const feedUrlObj = new URL(feed.feedUrl);
          homepageUrl = `${feedUrlObj.protocol}//${feedUrlObj.hostname}`;
        } catch (e) {
          homepageUrl = '';
        }
      }
      if (!homepageUrl && feedUrl) {
        // Last fallback: derive homepage from RSS URL
        try {
          const urlObj = new URL(feedUrl);
          homepageUrl = `${urlObj.protocol}//${urlObj.hostname}`;
        } catch (e) {
          homepageUrl = '';
        }
      }

      if (homepageUrl) {
        db.run('UPDATE feeds SET homepage_url = ? WHERE id = ?', [homepageUrl, feedId]);
        console.log(`Updated homepage URL for feed ${feedId}: ${homepageUrl}`);
      }
    }

    const stmt = db.prepare(`
      INSERT OR IGNORE INTO articles (feed_id, title, link, description, pub_date, guid, is_read)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of feed.items) {
      // Convert RSS/Atom date to ISO format for proper sorting
      let pubDate = null;
      // Try isoDate first (already in ISO format from parser), then pubDate
      if (item.isoDate) {
        pubDate = item.isoDate;
      } else if (item.pubDate) {
        try {
          pubDate = new Date(item.pubDate).toISOString();
        } catch (e) {
          pubDate = item.pubDate; // fallback to original if conversion fails
        }
      }

      stmt.run([
        feedId,
        item.title,
        item.link,
        item.contentSnippet || item.content,
        pubDate,
        item.guid || item.link,
        markAsReadInitially ? 1 : 0
      ]);
    }
    stmt.finalize();

    // Update last fetched time
    db.run('UPDATE feeds SET last_fetched = CURRENT_TIMESTAMP WHERE id = ?', [feedId]);
    console.log(`Fetched ${feed.items.length} articles from feed ${feedId}${markAsReadInitially ? ' (marked as read)' : ''}`);
  } catch (error) {
    console.error(`Error fetching feed ${feedId}:`, error.message);
  }
}

// Fetch all feeds every 30 minutes
cron.schedule('*/30 * * * *', async () => {
  console.log('Fetching all feeds...');
  const feeds = await getFeeds();
  for (const feed of feeds) {
    await fetchFeedArticles(feed.id, feed.url);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Whackamole RSS running on http://0.0.0.0:${PORT}`);
});