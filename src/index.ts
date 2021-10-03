import * as express from 'express';
import * as admin from 'firebase-admin';
import * as path from 'path';

admin.initializeApp({
  credential: admin.credential.cert(
    path.resolve(
      __dirname,
      "./serviceAccountKeys/razormafia-e1ac2-firebase-adminsdk-pll99-0b84d9225c.json"
    )
  ),
  databaseURL:
    "https://razormafia-e1ac2-default-rtdb.europe-west1.firebasedatabase.app",
});


const app = express();

app.post('/enter-queue', () => {});
app.post('/exit-queue', () => {});

app.listen(3002);