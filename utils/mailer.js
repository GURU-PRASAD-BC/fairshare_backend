const nodemailer = require('nodemailer');

// Email transporter setup
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

//General Mailer
const sendMail = async (recipientEmail, subject, htmlContent) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: recipientEmail,
    subject,
    html: htmlContent,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${recipientEmail}`);
  } catch (error) {
    console.error(`Failed to send email to ${recipientEmail}:`, error);
  }
};

//SendGroupMail
const sendGroupInvitationMail = async (recipientEmail, groupName) => {
  const subject = `You're invited to join the group "${groupName}" on FinestShare!`;
  const htmlContent = `
    <h1>Join the Group: ${groupName}</h1>
    <p>You have been invited to join the group <strong>${groupName}</strong> on FinestShare.</p>
    <p>Click <a href="http://localhost:3000/signup">here</a> to sign up and join the group.</p>
    <br />
  `;
  await sendMail(recipientEmail, subject, htmlContent);
};

//SendFriendInvite
const sendFriendInvitationMail = async (recipientEmail) => {
  const subject = `You're invited to connect on FinestShare!`;
  const htmlContent = `
    <h1>Connect on FinestShare</h1>
    <p>You have been invited to join FinestShare and connect as a friend.</p>
    <p>Click <a href="http://localhost:3000/signup">here</a> to sign up and start sharing expenses.</p>
    <br />
    <img src="https://assets.splitwise.com/assets/pro/logo-337b1a7d372db4b56c075c7893d68bfc6873a65d2f77d61b27cb66b6d62c976c.svg" alt="Splitwise App" style="width:300px;height:auto;"/>
  `;
  await sendMail(recipientEmail, subject, htmlContent);
};

module.exports = { sendGroupInvitationMail, sendFriendInvitationMail ,sendMail};
