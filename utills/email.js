const nodemailer = require('nodemailer');
const moment = require('moment');

// Create the transporter outside of the class
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD,
  },
});

module.exports = class Email {
  constructor(user, password, token) {
    this.to = process.env.EMAIL;
    this.from = process.env.EMAIL;

    // Check if user, password, and token are defined before splitting
    if (user) {
      this.name = user.name ? user.name.split(' ')[0] : '';
      this.email = user.email ? user.email.split(' ')[0] : '';
    } else {
      this.name = '';
      this.email = '';
    }

    if (password) {
      this.password = password.split(' ')[0];
    } else {
      this.password = '';
    }

    if (token) {
      this.token = token.split(' ')[0];
    } else {
      this.token = '';
    }
  }

  async sendEmail() {
    try {
      await transporter.sendMail({
        from: this.from,
        to: this.to,
        subject:
          'Welcome to CarinaSoftLab Company - Management Staff Credentials',
        html: `
          <h2>Welcome to CarinaSoftLab Company - Management Staff Credentials</h2>
          <p>Dear ${this.name},</p>
          <p>I hope this email finds you well. On behalf of CarinaSoftLab Company, I would like to extend a warm welcome to you as a member of our esteemed Management Staff. We are thrilled to have you join our team and contribute your expertise to our organization's growth and success.</p>
          <p>To ensure a smooth onboarding process, please find below your login credentials:</p>
          <p><strong>Email:</strong> ${this.email}</p>
          <p><strong>Password:</strong> ${this.password}</p>
          <p>Please use the following login link to access our system:</p>
          <p><a href="[Login Link]">Login to CarinaSoftLab Company</a></p>
          <p>If you have any questions or require further assistance, please feel free to reach out to our HR department at [HR Contact Email/Phone].</p>
          <p>Once again, welcome to CarinaSoftLab Company! We look forward to working with you and achieving great milestones together.</p>
          <p>Best regards,<br>Your Name<br><em>CarinaSoftLab Company</em></p>
        `,
      });
      console.log('Email sent successfully!');
    } catch (error) {
      console.error('Error sending email:', error);
    }
  }

  async sendCheckInEmail() {
    try {
      transporter.sendMail({
        from: this.from,
        to: this.email,
        subject: 'Check-in Warning',
        html: `
          <h2>Check-in Warning</h2>
          <p>Dear ${this.name},</p>
          <p>This is a reminder that you have not checked in for today's work. Please make sure to check-in as soon as possible.</p>
          <p>If you have any issues or need assistance, please reach out to your supervisor or the HR department.</p>
          <p>Thank you.</p>
        `,
      });
      console.log(`Email sent to ${this.name} for check-in warning.`);
    } catch (error) {
      console.error('Error sending email:', error);
    }
  }

  async sendForgotPasswordEmail() {
    try {
      await transporter.sendMail({
        from: this.from,
        to: this.to,
        subject: 'CarinaSoftLab Company - Password Reset Request',
        html: `
          <h2>CarinaSoftLab Company - Password Reset Request</h2>
          <p>Dear ${this.name},</p>
          <p>We received a request to reset your password for your CarinaSoftLab Company account. If you did not make this request, please ignore this email.</p>
          <p>To reset your password, please click the following link:</p>
          <p><a href="${this.token}">Reset Password</a></p>
          <p>If you are having trouble clicking the link, you can copy and paste the URL below into your web browser:</p>

          <p>This link will expire in 10 min for security reasons. If you did not request a password reset or need further assistance, please contact our support team at [Support Contact Email/Phone].</p>
          <p>Thank you for choosing CarinaSoftLab Company.</p>
          <p>Best regards,<br>Your Name<br><em>CarinaSoftLab Company</em></p>
        `,
      });
      console.log('Password reset email sent successfully!');
    } catch (error) {
      console.error('Error sending password reset email:', error);
    }
  }

  async sendContactDetails(
    name,
    email,
    contactNumber,
    address,
    message,
    service,
    budget
  ) {
    try {
      await transporter.sendMail({
        from: this.from,
        to: this.to,
        subject: 'Contact Details - Contact Us Page',
        html: `
          <p>Dear Admin,</p>
          <p>You have received a new contact details submission. Below are the details:</p>
          <ul>
            <li><strong>Name:</strong> ${name}</li>
            <li><strong>Email:</strong> ${email}</li>
            <li><strong>Contact Number:</strong> ${contactNumber}</li>
            <li><strong>Service:</strong> ${service}</li>
            <li><strong>Budget:</strong> ${budget}</li>
            <li><strong>Country:</strong> ${address}</li>
            <li><strong>Messge:</strong> ${message}</li>
          </ul>
          <p>Please reach out to the contact as needed.</p>
        `,
      });
      console.log('Email sent successfully!');
    } catch (error) {
      console.error('Error sending email:', error);
    }
  }

  async sendServiceDetails(name, email, contactNumber, message) {
    try {
      await transporter.sendMail({
        from: this.from,
        to: this.to,
        subject: 'Contact Details - Service Page',
        html: `
         
          <p>Dear Admin,</p>
          <p>You have received a new contact details submission. Below are the details:</p>
          <ul>
            <li><strong>Name:</strong> ${name}</li>
            <li><strong>Email:</strong> ${email}</li>
            <li><strong>Contact Number:</strong> ${contactNumber}</li>
            <li><strong>Messge:</strong> ${message}</li>
          </ul>
          <p>Please reach out to the contact as needed.</p>
        `,
      });
      console.log('Email sent successfully!');
    } catch (error) {
      console.error('Error sending email:', error);
    }
  }

  async sendThankYou(name, email) {
    console.log(name, email);
    try {
      await transporter.sendMail({
        from: this.from,
        to: email,
        subject: 'Thank You For Contacting Carina Softlabs Inc.',
        html: `
       <div style="max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4; border-radius: 8px;">
        <h3 style="color: #2c3e50;">Hi ${name},</h3>
        <p>Thank you for connecting with <strong>Carina Softlabs</strong>. We appreciate your interest in our services and look forward to assisting you to the best of our expertise!</p>
        <p>Our team will revert to you shortly!</p>
        <p>Regards,<br><strong>Carina Softlabs Inc.</strong></p>
    </div>
        `,
      });
      console.log('Email sent successfully!');
    } catch (error) {
      console.error('Error sending email:', error);
    }
  }

  async sendLateCheckInEmail() {
    try {
      await transporter.sendMail({
        from: this.from,
        to: this.email,
        subject: 'Absence Notification Due to Late Check-in',
        html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #d9534f;">⚠️ Absence Notification</h2>
          <p>Dear ${this.name},</p>
          <p>We regret to inform you that due to a late check-in exceeding the allowed time, you have been marked as <strong>absent</strong> for today (${moment().format(
            'DD-MM-YYYY'
          )}).</p>
          <p>Your attendance is crucial, and we encourage you to ensure timely check-ins moving forward to avoid further absences.</p>
          <br>
          <p>Best regards,</p>
          <p><strong>HR Department</strong></p>
          <p>Regards,<br><strong>Carina Softlabs Inc.</strong></p>
        </div>
      `,
      });

      console.log(
        `Absence notification email sent to ${this.name} (${this.email}).`
      );
    } catch (error) {
      console.error('Error sending absence notification email:', error);
    }
  }
};
