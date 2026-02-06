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
 * @param {Array} options.attachments - Email attachments
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
            attachments: options.attachments || undefined,
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
    // ============================================
    // EXISTING TEMPLATES
    // ============================================

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

    // ============================================
    // NEW REGISTRATION TEMPLATES
    // ============================================

    // Registration confirmation (FREE event)
    registrationConfirmationFree: (registration, event) => {
        return {
            subject: `✅ Registration Confirmed - ${event.title}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                        <h1 style="color: white; margin: 0;">🎉 Registration Confirmed!</h1>
                    </div>
                    
                    <div style="padding: 30px; background: #f9f9f9;">
                        <p style="color: #333; font-size: 16px;">Hi ${registration.name},</p>
                        
                        <p style="color: #666;">Your registration for <strong>${event.title}</strong> has been confirmed!</p>
                        
                        <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; border: 2px solid #28a745;">
                            <h3 style="color: #28a745; margin-top: 0;">✓ CONFIRMED</h3>
                            <p style="margin: 5px 0; color: #333;"><strong>📋 Registration ID:</strong> ${registration.registrationId || `REG-${registration.id}`}</p>
                            <p style="margin: 5px 0; color: #333;"><strong>🎫 Type:</strong> ${registration.registrationType === 'team' ? 'Team Registration' : 'Individual Registration'}</p>
                            ${registration.categoryName ? `<p style="margin: 5px 0; color: #333;"><strong>📂 Category:</strong> ${registration.categoryName}</p>` : ''}
                            ${registration.teamName ? `<p style="margin: 5px 0; color: #333;"><strong>👥 Team:</strong> ${registration.teamName}</p>` : ''}
                        </div>
                        
                        <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
                            <h3 style="color: #667eea; margin-top: 0;">Event Details</h3>
                            <p style="margin: 5px 0; color: #333;"><strong>📅 Date:</strong> ${new Date(event.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            <p style="margin: 5px 0; color: #333;"><strong>🕐 Time:</strong> ${event.time}</p>
                            <p style="margin: 5px 0; color: #333;"><strong>📍 Location:</strong> ${event.location}</p>
                        </div>
                        
                        ${registration.verificationToken ? `
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.CLIENT_URL}/registrations/track?token=${registration.verificationToken}" 
                               style="display: inline-block; background: #667eea; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                                📥 View Registration Details
                            </a>
                        </div>
                        <p style="color: #999; font-size: 12px; text-align: center;">
                            Save this link to view or edit your registration
                        </p>
                        ` : ''}
                        
                        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <p style="margin: 5px 0; color: #856404;"><strong>📌 Important:</strong></p>
                            <ul style="color: #856404; margin: 10px 0; padding-left: 20px;">
                                <li>Check your email for PDF receipt</li>
                                <li>Arrive 30 minutes early for check-in</li>
                                <li>Bring valid ID card</li>
                            </ul>
                        </div>
                        
                        <p style="color: #999; font-size: 12px; margin-top: 30px; text-align: center;">
                            JUST Debate Club © ${new Date().getFullYear()}
                        </p>
                    </div>
                </div>
            `,
        };
    },

    // Registration confirmation (PENDING PAYMENT)
    registrationPendingPayment: (registration, event, paymentUrl) => {
        return {
            subject: `⏳ Payment Required - ${event.title}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                        <h1 style="color: white; margin: 0;">⏳ Payment Required</h1>
                    </div>
                    
                    <div style="padding: 30px; background: #f9f9f9;">
                        <p style="color: #333; font-size: 16px;">Hi ${registration.name},</p>
                        
                        <p style="color: #666;">Thank you for registering for <strong>${event.title}</strong>!</p>
                        
                        <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; border: 2px solid #ffc107;">
                            <h3 style="color: #ffc107; margin-top: 0;">⏳ PENDING PAYMENT</h3>
                            <p style="margin: 5px 0; color: #333;"><strong>📋 Registration ID:</strong> ${registration.registrationId || `REG-${registration.id}`}</p>
                            <p style="margin: 5px 0; color: #333;"><strong>💰 Amount:</strong> ${registration.amount} BDT</p>
                            ${registration.categoryName ? `<p style="margin: 5px 0; color: #333;"><strong>📂 Category:</strong> ${registration.categoryName}</p>` : ''}
                            ${registration.teamName ? `<p style="margin: 5px 0; color: #333;"><strong>👥 Team:</strong> ${registration.teamName}</p>` : ''}
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${paymentUrl}" 
                               style="display: inline-block; background: #28a745; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                                💳 Pay Now
                            </a>
                        </div>
                        
                        <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
                            <h3 style="color: #667eea; margin-top: 0;">Event Details</h3>
                            <p style="margin: 5px 0; color: #333;"><strong>📅 Date:</strong> ${new Date(event.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            <p style="margin: 5px 0; color: #333;"><strong>🕐 Time:</strong> ${event.time}</p>
                            <p style="margin: 5px 0; color: #333;"><strong>📍 Location:</strong> ${event.location}</p>
                        </div>
                        
                        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <p style="margin: 5px 0; color: #856404;"><strong>⚠️ Complete payment to confirm your spot!</strong></p>
                            <p style="margin: 5px 0; color: #856404;">Your registration will be confirmed once payment is received.</p>
                        </div>
                        
                        <p style="color: #999; font-size: 12px; margin-top: 30px; text-align: center;">
                            JUST Debate Club © ${new Date().getFullYear()}
                        </p>
                    </div>
                </div>
            `,
        };
    },

    // Payment successful
    paymentSuccessful: (registration, event, payment) => {
        return {
            subject: `✅ Payment Confirmed - ${event.title}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; text-align: center;">
                        <h1 style="color: white; margin: 0;">✅ Payment Successful!</h1>
                    </div>
                    
                    <div style="padding: 30px; background: #f9f9f9;">
                        <p style="color: #333; font-size: 16px;">Hi ${registration.name},</p>
                        
                        <p style="color: #666;">Your payment has been received and your registration is now <strong>CONFIRMED</strong>!</p>
                        
                        <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; border: 2px solid #28a745;">
                            <h3 style="color: #28a745; margin-top: 0;">✓ PAYMENT CONFIRMED</h3>
                            <p style="margin: 5px 0; color: #333;"><strong>📋 Registration ID:</strong> ${registration.registrationId || `REG-${registration.id}`}</p>
                            <p style="margin: 5px 0; color: #333;"><strong>💰 Amount Paid:</strong> ${payment.amount} BDT</p>
                            <p style="margin: 5px 0; color: #333;"><strong>💳 Payment Method:</strong> ${payment.cardBrand || payment.paymentMethod || 'SSLCommerz'}</p>
                            <p style="margin: 5px 0; color: #333;"><strong>🔢 Transaction ID:</strong> ${payment.transactionId}</p>
                            <p style="margin: 5px 0; color: #333;"><strong>📅 Date:</strong> ${new Date(payment.paidAt).toLocaleString()}</p>
                        </div>
                        
                        <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
                            <h3 style="color: #667eea; margin-top: 0;">Event Details</h3>
                            <p style="margin: 5px 0; color: #333;"><strong>📅 Date:</strong> ${new Date(event.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            <p style="margin: 5px 0; color: #333;"><strong>🕐 Time:</strong> ${event.time}</p>
                            <p style="margin: 5px 0; color: #333;"><strong>📍 Location:</strong> ${event.location}</p>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.CLIENT_URL}/events/${event.id}" 
                               style="display: inline-block; background: #667eea; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                                📄 View Event Details
                            </a>
                        </div>
                        
                        <div style="background: #d1ecf1; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <p style="margin: 5px 0; color: #0c5460;"><strong>📌 Next Steps:</strong></p>
                            <ul style="color: #0c5460; margin: 10px 0; padding-left: 20px;">
                                <li>Download your PDF receipt (attached)</li>
                                <li>Arrive 30 minutes early for check-in</li>
                                <li>Bring this receipt and valid ID</li>
                            </ul>
                        </div>
                        
                        <p style="color: #999; font-size: 12px; margin-top: 30px; text-align: center;">
                            JUST Debate Club © ${new Date().getFullYear()}
                        </p>
                    </div>
                </div>
            `,
        };
    },

    // Certificate issued
    certificateIssued: (participantName, event, credentialId, role) => {
        return {
            subject: `🎓 Certificate Issued - ${event.title}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                        <h1 style="color: white; margin: 0;">🎓 Certificate Issued!</h1>
                    </div>
                    
                    <div style="padding: 30px; background: #f9f9f9;">
                        <p style="color: #333; font-size: 16px;">Hi ${participantName},</p>
                        
                        <p style="color: #666;">Congratulations! Your certificate for <strong>${event.title}</strong> has been issued.</p>
                        
                        <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; border: 2px solid #667eea;">
                            <p style="margin: 5px 0; color: #333;"><strong>📜 Credential ID:</strong> <code style="background: #f0f0f0; padding: 2px 8px; border-radius: 4px;">${credentialId}</code></p>
                            <p style="margin: 5px 0; color: #333;"><strong>🎭 Role:</strong> ${role || 'Participant'}</p>
                            <p style="margin: 5px 0; color: #333;"><strong>🎓 Event:</strong> ${event.title}</p>
                            <p style="margin: 5px 0; color: #333;"><strong>📅 Date:</strong> ${new Date(event.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.CLIENT_URL}/certificates/verify/${credentialId}" 
                               style="display: inline-block; background: #667eea; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                                📥 Download Certificate
                            </a>
                        </div>
                        
                        <p style="color: #666; font-size: 14px; text-align: center;">
                            You can verify this certificate at:<br>
                            <a href="${process.env.CLIENT_URL}/verify-certificate/${credentialId}" style="color: #667eea;">
                                ${process.env.CLIENT_URL}/verify-certificate/${credentialId}
                            </a>
                        </p>
                        
                        <p style="color: #999; font-size: 12px; margin-top: 30px; text-align: center;">
                            JUST Debate Club © ${new Date().getFullYear()}
                        </p>
                    </div>
                </div>
            `,
        };
    },

    // Team member invitation
    teamMemberInvitation: (memberName, teamName, event, teamLeader) => {
        return {
            subject: `👥 You're invited to join ${teamName} - ${event.title}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                        <h1 style="color: white; margin: 0;">👥 Team Invitation</h1>
                    </div>
                    
                    <div style="padding: 30px; background: #f9f9f9;">
                        <p style="color: #333; font-size: 16px;">Hi ${memberName},</p>
                        
                        <p style="color: #666;">You've been added to team <strong>${teamName}</strong> for <strong>${event.title}</strong>!</p>
                        
                        <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
                            <h3 style="color: #667eea; margin-top: 0;">Team Details</h3>
                            <p style="margin: 5px 0; color: #333;"><strong>👥 Team Name:</strong> ${teamName}</p>
                            <p style="margin: 5px 0; color: #333;"><strong>👤 Team Leader:</strong> ${teamLeader}</p>
                        </div>
                        
                        <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
                            <h3 style="color: #667eea; margin-top: 0;">Event Details</h3>
                            <p style="margin: 5px 0; color: #333;"><strong>📅 Date:</strong> ${new Date(event.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            <p style="margin: 5px 0; color: #333;"><strong>🕐 Time:</strong> ${event.time}</p>
                            <p style="margin: 5px 0; color: #333;"><strong>📍 Location:</strong> ${event.location}</p>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.CLIENT_URL}/events/${event.id}" 
                               style="display: inline-block; background: #667eea; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                                View Event Details
                            </a>
                        </div>
                        
                        <p style="color: #999; font-size: 12px; margin-top: 30px; text-align: center;">
                            JUST Debate Club © ${new Date().getFullYear()}
                        </p>
                    </div>
                </div>
            `,
        };
    },
};
