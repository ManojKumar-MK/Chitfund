# How to Enable Firebase Authentication

To fix the login and permission issues (`auth/operation-not-allowed` and "Permission Denied" errors), you must enable the Email/Password sign-in provider in your Firebase Console.

### Step 1: Go to Firebase Console
1. Open your browser and go to [console.firebase.google.com](https://console.firebase.google.com/).
2. Select your project: **`chit-fund-manager`** (or your specific project name).

### Step 2: Enable Authentication
1. In the left sidebar, click on **Build** -> **Authentication**.
2. Click on the **Get Started** button (if you haven't already).
3. Select the **Sign-in method** tab.
4. Click on **Email/Password**.
5. Toggle the **Enable** switch to **ON**.
   - *Note: You do NOT need to enable "Email link (passwordless sign-in)".*
6. Click **Save**.

### Step 3: Enable Firestore Database (If not already)
1. In the left sidebar, click **Build** -> **Firestore Database**.
2. If it's not created, click **Create Database**.
3. Choose **Start in Test Mode** for now (easier for development) or **Production Mode** if you are ready to configure rules.
   - *If using Production Mode, ensure your rules allow reads/writes.*

### Step 4: Enable Storage (For Documents)
1. In the left sidebar, click **Build** -> **Storage**.
2. Click **Get Started**.
3. Choose **Start in Test Mode** (recommended for initial dev) or set up rules.
4. Click **Done**.

### Step 5: Verify in App
1. Go back to your running app.
2. Refresh the page.
3. Try logging in with `2klubyt@gmail.com` and `123456`.
   - *It should now successfully create the user in Firebase and log you in for real.*
