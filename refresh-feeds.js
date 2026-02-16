const sqlite3 = require('sqlite3').verbose();
const Parser = require('rss-parser');

const db = new sqlite3.Database('./data/rss_reader.db');
const parser = new Parser();

async function refreshFeeds() {
  // Get all feeds
  const feeds = await new Promise((resolve, reject) => {
    db.all('SELECT * FROM feeds', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  for (const feed of feeds) {
    console.log(`Refreshing feed: ${feed.title}`);
    try {
      const parsedFeed = await parser.parseURL(feed.url);
      
      for (const item of parsedFeed.items) {
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

        // Update existing articles with proper pub_date
        db.run(`
          UPDATE articles 
          SET pub_date = ? 
          WHERE feed_id = ? AND (link = ? OR guid = ?)
        `, [pubDate, feed.id, item.link, item.guid || item.link]);
      }
    } catch (error) {
      console.error(`Error refreshing feed ${feed.id}:`, error.message);
    }
  }

  console.log('Feed refresh complete!');
  db.close();
}

refreshFeeds();