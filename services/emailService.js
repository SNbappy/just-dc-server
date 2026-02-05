// services/emailService.js
const nodemailer = require('nodemailer');

// Create reusable transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

// Verify connection
transporter.verify((error, success) => {
    if (error) {
        console.error('❌ Email service error:', error);
    } else {
        console.log('✅ Email service ready');
    }
});

/**
 * Send email
 * @param {Object} options - Email options
 * @param {string|string[]} options.to - Recipient email(s)
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text content
 * @param {string} options.html - HTML content
 * @param {string[]} options.cc - CC recipients
 * @param {string[]} options.bcc - BCC recipients
 */
exports.sendEmail = async (options) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_FROM || 'JUST Debate Club <noreply@justdebateclub.com>',
            to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
            subject: options.subject,
            text: options.text,
            html: options.html,
            cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
            bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined,
        };

        const info = await transporter.sendMail(mailOptions);

        console.log('✅ Email sent:', info.messageId);
        return {
            success: true,
            messageId: info.messageId,
        };
    } catch (error) {
        console.error('❌ Email send error:', error);
        throw error;
    }
};

/**
 * Email templates
 */
exports.templates = {
    // Event announcement
    eventAnnouncement: (event, recipientName) => {
        return {
            subject: `📢 New Event: ${event.title}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                        <h1 style="color: white; margin: 0;">JUST Debate Club</h1>
                    </div>
                    
                    <div style="padding: 30px; background: #f9f9f9;">
                        <p style="color: #333; font-size: 16px;">Hi ${recipientName || 'there'},</p>
                        
                        <p style="color: #666;">We're excited to announce a new event!</p>
                        
                        <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
                            <h2 style="color: #667eea; margin-top: 0;">${event.title}</h2>
                            <p style="color: #666; line-height: 1.6;">${event.description}</p>
                            
                            <div style="margin: 15px 0;">
                                <p style="margin: 5px 0; color: #333;"><strong>📅 Date:</strong> ${new Date(event.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                <p style="margin: 5px 0; color: #333;"><strong>🕐 Time:</strong> ${event.time}</p>
                                <p style="margin: 5px 0; color: #333;"><strong>📍 Location:</strong> ${event.location}</p>
                                ${event.registrationFee > 0 ? `<p style="margin: 5px 0; color: #333;"><strong>💰 Fee:</strong> ${event.registrationFee}৳</p>` : '<p style="margin: 5px 0; color: #28a745;"><strong>✓ Free Event</strong></p>'}
                            </div>
                            
                            <a href="${process.env.CLIENT_URL}/events/${event.id}" 
                               style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 15px;">
                                View Details & Register
                            </a>
                        </div>
                        
                        <p style="color: #999; font-size: 12px; margin-top: 30px;">
                            You received this email because you are a member of JUST Debate Club.
                        </p>
                    </div>
                </div>
            `,
        };
    },

    // Custom message
    customMessage: (subject, message, senderName) => {
        return {
            subject: subject,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                        <h1 style="color: white; margin: 0;">JUST Debate Club</h1>
                    </div>
                    
                    <div style="padding: 30px; background: #f9f9f9;">
                        <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
                            <div style="color: #333; line-height: 1.6; white-space: pre-wrap;">${message}</div>
                        </div>
                        
                        <p style="color: #666; margin-top: 20px;">
                            <strong>Sent by:</strong> ${senderName}<br>
                            <strong>From:</strong> JUST Debate Club Management
                        </p>
                        
                        <p style="color: #999; font-size: 12px; margin-top: 30px;">
                            You received this email because you are a member of JUST Debate Club.
                        </p>
                    </div>
                </div>
            `,
        };
    },
};
