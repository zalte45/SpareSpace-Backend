# SpareSpace Backend

## Getting started

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment variables

Create a `.env` file in the project root with:

```bash
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
EMAIL_USER=your_email_address
EMAIL_PASS=your_email_password_or_app_password
```

> Required because `src/config/config.js` throws if any of these are missing.

### 3) Run the backend (development)

```bash
npm run dev
```

Server runs at:
- http://localhost:3000

## API base path

The backend mounts auth routes under `/api`:

- `POST   /api/register`
- `GET    /api/getMe`
- `POST   /api/login`
- `GET    /api/logout`
- `POST   /api/verifyOtp`
- `POST   /api/forgotOtp`
- `POST   /api/forgotOtpVerify`
- `POST   /api/newPassword`

## Notes

- CORS is configured for `http://localhost:5173` and cookies are enabled (`credentials: true`).
- Refresh token is stored in an HTTP-only cookie named `refreshToken`.

