# Whackamole RSS

A self-hosted RSS/Atom feed reader. New links from the feeds you are following pop up on the main page, and when you click one, it disappears. You only see what's unread.

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up the database**:
   ```bash
   npm run setup-db
   ```

3. **Start the server**:
   ```bash
   npm start
   # or for development:
   npm run dev
   ```

4. **Open your browser** to `http://localhost:2999`

## Usage

1. **Add feeds**: Go to "Manage Feeds" and add RSS/Atom feed URLs
2. **Read links**: The home page shows unread links from your feeds - click any link to open in a new tab, and it will be marked as read
3. **Browse archive**: View a history of all links in the Archive section

## Docker

```bash
docker-compose up -d --build
```

The app will be available at `http://localhost:3424`. See [DEPLOYMENT.md](DEPLOYMENT.md) for full deployment instructions including Nginx reverse proxy setup.

## License

MIT
