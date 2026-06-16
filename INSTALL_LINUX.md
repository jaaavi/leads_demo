# Linux Installation with systemd

This document describes a private production-style Linux deployment. It is not required for the public Vercel demo.

The public demo runs through `api/index.js` on Vercel and uses mock data only.

## 1. Copy the Service File

Copy `leads-dashboard.service` to systemd:

```bash
sudo cp leads-dashboard.service /etc/systemd/system/
```

Or create it manually:

```bash
sudo nano /etc/systemd/system/leads-dashboard.service
```

## 2. Edit the Service File

Update these values:

1. `WorkingDirectory`

   ```ini
   WorkingDirectory=/home/your-user/path-to-project/server
   ```

2. `SESSION_SECRET`

   Generate a secure value:

   ```bash
   openssl rand -base64 32
   ```

3. MySQL configuration

   Make sure the socket path, database, user, and password match your private server.

## 3. Reload systemd

```bash
sudo systemctl daemon-reload
```

## 4. Enable the Service

```bash
sudo systemctl enable leads-dashboard.service
```

## 5. Start the Service

```bash
sudo systemctl start leads-dashboard.service
```

## Check Status

```bash
sudo systemctl status leads-dashboard.service
```

Follow logs:

```bash
sudo journalctl -u leads-dashboard.service -f
```

## Useful Commands

Stop:

```bash
sudo systemctl stop leads-dashboard.service
```

Restart:

```bash
sudo systemctl restart leads-dashboard.service
```

Last 100 logs:

```bash
sudo journalctl -u leads-dashboard.service -n 100
```

Errors only:

```bash
sudo journalctl -u leads-dashboard.service -p err
```

## Service File Notes

Important fields:

- `After=network.target mysql.service`: waits for network and MySQL.
- `User=www-data`: user running the process.
- `ExecStart=/usr/bin/node app.js`: command to run.
- `Restart=always`: restarts automatically after crashes.
- `Environment`: runtime configuration.

## Troubleshooting

### `Failed to start leads-dashboard.service`

Check logs:

```bash
sudo journalctl -u leads-dashboard.service -p err
```

Common causes:

- `WorkingDirectory` does not exist.
- Node.js is not installed at `/usr/bin/node`.
- MySQL is not running.
- The service user lacks permissions.

### `Cannot find module`

Run:

```bash
npm install
```

### MySQL connection error

Check:

- MySQL user and password.
- Database existence.
- Socket path:

```bash
ls -la /var/run/mysqld/mysqld.sock
```

### Port already in use

Change `PORT` in the service file.
