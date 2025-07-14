const ContactController = require("./mail");
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');

const qrFolder = path.join(__dirname, 'qr_codes');
if (!fs.existsSync(qrFolder)) {
    fs.mkdirSync(qrFolder);
}
const express = require('express');

const router = express.Router();

const androidLink = 'https://play.google.com/store/apps/details?id=com.slingshotthehowitzer.techymau';
const iosLink = 'https://apps.apple.com/in/app/howitzer-slingshot-adventure/id1503652664';

router.post('/getContactDetails', ContactController.contactDetails);
router.post('/getServiceDetails', ContactController.serviceDetails);

router.get('/generate-qr', (req, res) => {
    const qrData = 'http://192.168.29.184:8084/csl/v1/redirect';
    const filePath = path.join(qrFolder, 'qr_code.png');

    // Generate and store the QR code as a PNG file
    qrcode.toFile(filePath, qrData, (err) => {
        if (err) return res.send('Error occurred while generating QR code');

        // Serve the QR code image from the file system
        res.send(`
            <h1>Scan the QR code</h1>
            <img src="/qr_codes/qr_code.png" alt="QR Code" />
        `);
    });
});

router.get('/redirect', (req, res) => {
    const userAgent = req.headers['user-agent'] || '';

    console.log(userAgent, "df")
    if (/android/i.test(userAgent)) {
        res.redirect(androidLink);
    } else if (/iphone|ipad|ipod/i.test(userAgent)) {
        res.redirect(iosLink);
    } else {
        // Default page if neither Android nor iOS
        res.send('This link is intended for mobile devices. Please visit using your phone.');
    }
});

module.exports = router;