import express from "express";
import admin from "firebase-admin";
import QRCode from "qrcode";
import cors from "cors";
import multer from "multer";
import csv from "csv-parser";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import nodemailer from "nodemailer";

const app = express();
app.use(express.json());
app.use(cors());

// Initialize Firebase
const serviceAccount = {
  type: "service_account",
  project_id: "qrscanner-3c5ca",
  private_key_id: "c67e9b91aad9d279b49647fb899d4ad2def52784",
  private_key: `-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDJyj4MXev7V7Ok\njDOjsuo2wHe6T5otDJ9pz0lwi9VoD1QdcyU6g3QlW5O3nROOyF6ZOdJ+YIsXvXLV\nkqtowJCVkB5tKefcbIuNRLln7zz5BhUoa/s0wmSa2zY4x3dO26HT0J4bcubx3eY/\n5j93xOU/wa4wCYkjgPveF2VLDP+97qvXUedlhX1g0XVbv+160b4/sdrURVj6ttwD\nv3c5qTgdMMwln1Ykg3TId5joftBeAerbmNEdVCZh1WTFBvyRK03MzVv45noBTf60\nKYVEu/fGbVAlVIpNwCDkHyAtgg4Zgn45EtDGjhhEd48RYR48htLxxvOMNZQm6lX9\nXgAEEvKpAgMBAAECggEADx7NKvKPt+/wqVQLG4lQxQUDg62qzRTczhom89y6gzdg\n02sZH0sR1SnJRhEqUcDgW8VqKSeVTJRYyjmZB/qj6t0XdpEVC16Dz3RWmzvhOvyy\ncaqzsladoL/rznHd1gYdmGhRrJddyEJbGi8n0tLpZa9e3MEeKk+kL9Zbc/X3pNTe\n9mq3OLIYXH50hfRvNoKoDyNM3M9bddWKyk57oDz5Cjl4KOtfzrBBpjV/NzJfCmm6\nEyuF7t6nP2J5lzYOam2J9kTnBHMrA1/uSfDpePi/culM56tKViC6Z8+CuV2S5/xB\nPi3YUf2j4pyb+0l7DHhmPjrpu+N+oXDtGgURwpOz3QKBgQD/frYE3Z0Gu1+50MZf\ngwywSnkJEwhsNNOw6kxb4MDuWon7iMRDIVe5TapFKOzhrNpJn0R336o4H3HPKqb9\nNGlw898W+Zqc8igQVTu79+ru7PMMA6+iWYoFOyCZBPDkqDUo3zT6Fo9Sh/zUDxF7\nrtWKQmU4HuVGYSxheIh0ZS6o5QKBgQDKMFrYR2FJOQ+57nfYVb3otVSNgp4ls9z1\nVawWyZG//sH0cfoD03spYrx3g0bMx4E+Kr5MbB7hIix70+tf+VwYurO88buUxyio\n0oSQu0GxWmjTNItZSjyEs31pb/8T9jNSR15hJ5xbPxsUQwvPBfyF8dpj3v+az8mG\noWs5Py6adQKBgQDrXPom71SZgAFGNvqXwCzvNhvb7SmkLOIapyxis2Bn8wYLrslG\nIjAi51YE0heuKcMJcWvsliHEA8ufEea1eRPtVutbyeLR1A5uRWZ62X8WTTf1CGxC\nvgN0oCx+alvT+NTH6x9th1zOpbGWVK9BZiUXceS211dVB22P+S6TMybRtQKBgF21\nB4WRn482OQmtcjH7mybNU8C6Nt22fMPfzwBIr5pSUkYexQcc7soBjuO9HgUuucG8\nQbJdsfoZwpApab9zbLGxZjg9uPh9TWThHLuPbiTqiAbLJYJem6nNHmTNmWUBCEwr\n85wHpbnMh5pecIykc6MIsnTzF3gCsZ4KFg3UMJ85AoGBANf7ihRYSYNNXeRGkOxG\na6NaxECdJTolSGj1wFbGPnjtExERO2sFM20YhzFSibi9eOXtUz12iqhVcJ/IjWso\nQDL9s2N0qmJ17Kzp1iMrkWOLviYWBOd+91HV3Nsb0eEoQ7aHwM4T3OmRCkuOS1MR\nUXnNna4yJuWVzC8+SGYkHKhA\n-----END PRIVATE KEY-----\n`,
  client_email:
    "firebase-adminsdk-fbsvc@qrscanner-3c5ca.iam.gserviceaccount.com",
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

app.post("/create-account", async (req, res) => {
  const { name, email } = req.body;
  if (!name || !email)
    return res.status(400).json({ error: "Name and email are required" });

  const userRef = db.collection("users").doc(email);
  const userDoc = await userRef.get();

  if (userDoc.exists) {
    return res.status(400).json({ error: "User already registered!" });
  }

  const qrCodeData = `${email}-${Date.now()}`;

  try {
    await userRef.set({ name, email, qrCode: qrCodeData, verified: false });

    res.json({ message: "Account created, QR sent via email!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/get-users", async (req, res) => {
  try {
    const usersSnapshot = await db.collection("users").get();
    const users = usersSnapshot.docs.map((doc) => doc.data());
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/verify-qr", async (req, res) => {
  const { qrCode } = req.body;

  try {
    const usersSnapshot = await db
      .collection("users")
      .where("qrCode", "==", qrCode)
      .get();

    if (usersSnapshot.empty) {
      return res
        .status(400)
        .json({ message: "Invalid QR Code", verified: false });
    }

    let userDoc = usersSnapshot.docs[0];
    let userData = userDoc.data();

    if (userData.verified) {
      return res.status(400).json({
        message: "User has already been verified and used their QR code.",
        verified: false,
      });
    }

    // Update user status to verified
    await userDoc.ref.update({ verified: true });

    res.json({ message: "QR Verified Successfully!", verified: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const upload = multer({ dest: "uploads/" });

app.post("/upload-csv", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const users = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on("data", (row) => {
      const name = row["Name"];
      const email = row["Email"];
      console.log(name, email);
      if (!name || !email) return;
      users.push({ name, email });
    })
    .on("end", async () => {
      try {
        for (let user of users) {
          console.log("User", user);
          const name = user["Name"];
          const email = user["Email"];
          console.log(name, email);
          if (!name || !email) continue;
        }

        fs.unlinkSync(req.file.path);

        users.forEach(async (user) => {
          console.log("User", user);
          const { name, email } = user;
          const userRef = db.collection("users").doc(email);
          const qrCodeData = `${email}-${uuidv4()}`;

          await userRef.set({
            name,
            email,
            qrCode: qrCodeData,
            verified: false,
          });
        });

        res.json({ message: "Users added successfully!" });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
});

app.delete("/delete-account", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  try {
    const userRef = db.collection("users").doc(email);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    await userRef.delete();
    res.json({ message: "Account deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// You send send Qr code to all users by getting all users email from firebase and sending them the qr code
const emailUser = "ramyan.palani3@gmail.com"; // Replace with your email
// const emailPassword = "qyswhrzpwhmugnwv"; // Replace with your password/app password
const emailPassword = "1RramyanN1"

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: emailUser,
    pass: emailPassword,
  },
});

// ===== ENDPOINT =====
app.post("/sendQr", async (req, res) => {
  try {
    // Get all users from Firestore
    const usersSnapshot = await db.collection("users").get();
    const users = usersSnapshot.docs.map(doc => doc.data());

    // Send emails to all users
    for (const user of users) {
      const { email, name, qrCode } = user;
      
      if (!email || !qrCode) {
        console.warn(`Skipping user with missing email/qrCode: ${name}`);
        continue;
      }

      try {
        // Generate QR code buffer
        const qrCodeBuffer = await QRCode.toBuffer(qrCode);

        // Create email
        const mailOptions = {
          from: `Event Manager <${emailUser}>`,
          to: email,
          subject: "Your Event QR Code",
          html: `<p>Hi ${name},</p>
                 <p>Here's your QR code for event access!</p>`,
          attachments: [{
            filename: "event-qrcode.png",
            content: qrCodeBuffer
          }]
        };

        // Send email
        await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${email}`);
        
      } catch (error) {
        console.error(`Failed to send to ${email}:`, error.message);
      }
    }

    res.json({ 
      success: true,
      message: `Emails sent to ${users.length} users successfully!`
    });
    
  } catch (error) {
    console.error("Endpoint error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(5000, () => console.log("Server running on port 5000"));

// qysw hrzp whmu gnwv