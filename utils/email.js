const nodemailer = require('nodemailer');


module.exports = class Email {
  constructor(user) {
    this.to = user.email;
    this.firstName = user.name.split(' ')[0];
    this.from = `Speechable Team <${process.env.EMAIL_FROM}>`;
  }

  newTransport() {
    if (process.env.NODE_ENV === 'production') {
      // Sendgrid
      return nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USERNAME,
          pass: process.env.GMAIL_PASSWORD
        }
      });
    }

    return nodemailer.createTransport({
      host: process.env.MAILTRAP_HOST,
      port: process.env.MAILTRAP_PORT,
      auth: {
        user: process.env.MAILTRAP_USERNAME,
        pass: process.env.MAILTRAP_PASSWORD
      }
    });
  }

  // Send the actual email
  async send(subject, text) {

    // 2) Define email options
    const mailOptions = {
      from: this.from,
      to: this.to,
      subject,
      text
    };

    // 3) Create a transport and send email
    await this.newTransport().sendMail(mailOptions);
  }

  async sendWelcome() {
    await this.send('welcome', 'Welcome to Speechable APP!');
  }

  async sendPasswordReset(resetPIN) {
    await this.send(
      'passwordReset',
      `use this PIN to reset your password: ${resetPIN}\n\nValid for 10 minutes\n\nIf you didn't request this, please ignore this email!`
    );
  }
};