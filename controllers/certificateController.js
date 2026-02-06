// controllers/certificateController.js
const Certificate = require('../models/Certificate');
const Event = require('../models/Event');
const EventRegistration = require('../models/EventRegistration');
const User = require('../models/User');
const { sendEmail, templates } = require('../services/emailService');
const { generateCertificate } = require('../services/pdfService');
const { Op } = require('sequelize');

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Generate unique credential ID with QR-compatible format
 */
const generateCredentialId = () => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9).toUpperCase();
    return `CERT-${timestamp}-${random}`;
};

/**
 * Send certificate email with PDF attachment
 */
const sendCertificateEmail = async (recipientEmail, recipientName, event, certificate, teamName = null, pdfPath = null) => {
    try {
        const emailOptions = {
            to: recipientEmail,
            subject: `🎉 Certificate Issued - ${event.title}`,
            html: generateCertificateEmailHTML(recipientName, event, certificate, teamName)
        };

        // Attach PDF if available
        if (pdfPath) {
            emailOptions.attachments = [{
                filename: `certificate_${certificate.credentialId}.pdf`,
                path: pdfPath
            }];
        }

        await sendEmail(emailOptions);

        console.log(`✅ Certificate email sent to: ${recipientEmail}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send certificate email to ${recipientEmail}:`, error.message);
        return false;
    }
};

/**
 * Generate certificate email HTML
 */
const generateCertificateEmailHTML = (recipientName, event, certificate, teamName = null) => {
    return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                <h1 style="color: white; margin: 0;">🎉 Certificate Issued!</h1>
            </div>
            
            <div style="padding: 30px; background: #f9f9f9;">
                <p style="color: #333; font-size: 16px;">Hi ${recipientName},</p>
                
                <p style="color: #666;">Congratulations! Your certificate for <strong>${event.title}</strong> has been issued and approved.</p>
                
                <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; border: 2px solid #667eea;">
                    <p style="margin: 5px 0; color: #333;"><strong>📜 Credential ID:</strong> <code style="background: #f0f0f0; padding: 2px 8px; border-radius: 4px;">${certificate.credentialId}</code></p>
                    <p style="margin: 5px 0; color: #333;"><strong>🎓 Event:</strong> ${event.title}</p>
                    <p style="margin: 5px 0; color: #333;"><strong>🎭 Role:</strong> ${certificate.role}</p>
                    ${teamName ? `<p style="margin: 5px 0; color: #333;"><strong>👥 Team:</strong> ${teamName}</p>` : ''}
                    ${certificate.achievement ? `<p style="margin: 5px 0; color: #333;"><strong>🏆 Achievement:</strong> ${certificate.achievement}</p>` : ''}
                    <p style="margin: 5px 0; color: #333;"><strong>📅 Date:</strong> ${new Date(event.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.CLIENT_URL}/dashboard/certificates" 
                       style="display: inline-block; background: #667eea; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.4);">
                        📥 View & Download Certificate
                    </a>
                </div>
                
                <div style="background: #e8f4f8; padding: 15px; border-radius: 8px; border-left: 4px solid #667eea; margin-top: 20px;">
                    <p style="margin: 0; color: #555; font-size: 14px;">
                        <strong>🔐 Verify Your Certificate:</strong><br>
                        Anyone can verify this certificate with QR code or at:<br>
                        <a href="${process.env.CLIENT_URL}/verify/${certificate.credentialId}" style="color: #667eea; word-break: break-all;">
                            ${process.env.CLIENT_URL}/verify/${certificate.credentialId}
                        </a>
                    </p>
                </div>
                
                <p style="color: #999; font-size: 12px; margin-top: 30px; text-align: center;">
                    JUST Debate Club © ${new Date().getFullYear()}
                </p>
            </div>
        </div>
    `;
};

// =====================================================
// PARTICIPANT CERTIFICATES
// =====================================================

/**
 * @desc    Issue certificate to event participant (registrant)
 * @route   POST /api/certificates/participant/:registrationId
 * @access  Private (Admin/President/GS only)
 */
exports.issueParticipantCertificate = async (req, res) => {
    try {
        const { registrationId } = req.params;
        const { achievement, teamMemberIndex } = req.body;

        // Authorization check
        const allowedRoles = ['admin', 'president', 'general_secretary'];
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Only Admin, President, or General Secretary can issue certificates'
            });
        }

        const registration = await EventRegistration.findByPk(registrationId);
        if (!registration) {
            return res.status(404).json({
                success: false,
                message: 'Registration not found'
            });
        }

        const event = await Event.findByPk(registration.eventId);
        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        let certificates = [];
        let emailsSent = 0;

        // Handle team registration
        if (registration.registrationType === 'team' && registration.teamMembers?.length > 0) {
            // Issue certificates for all team members
            for (const [index, member] of registration.teamMembers.entries()) {
                // Skip if specific team member index provided and doesn't match
                if (teamMemberIndex !== undefined && index !== parseInt(teamMemberIndex)) {
                    continue;
                }

                const existingCert = await Certificate.findOne({
                    where: {
                        eventId: event.id,
                        recipientEmail: member.email || registration.email,
                        certificateType: 'participant',
                    },
                });

                if (existingCert) {
                    certificates.push(existingCert);
                    continue;
                }

                const credentialId = generateCredentialId();

                // Generate certificate PDF with QR code
                let certificateUrl = null;
                let pdfPath = null;
                try {
                    const pdfResult = await generateCertificate({
                        participant: {
                            name: member.name,
                            email: member.email || registration.email
                        },
                        event,
                        credentialId,
                        role: 'Team Member',
                        teamName: registration.teamName,
                        achievement: achievement || null
                    });

                    certificateUrl = pdfResult.url;
                    pdfPath = pdfResult.filepath;

                    console.log('✅ Certificate PDF generated for:', member.name);
                } catch (pdfError) {
                    console.error('❌ Certificate PDF generation failed:', pdfError);
                }

                const cert = await Certificate.create({
                    credentialId,
                    eventId: event.id,
                    recipientName: member.name,
                    recipientEmail: member.email || registration.email,
                    userId: member.userId || registration.userId,
                    certificateType: 'participant',
                    role: 'Team Member',
                    teamName: registration.teamName,
                    achievement: achievement || null,
                    issuedBy: req.user.id,
                    status: 'issued',
                    certificateUrl
                });

                certificates.push(cert);

                // Send email with PDF
                const emailSent = await sendCertificateEmail(
                    member.email || registration.email,
                    member.name,
                    event,
                    cert,
                    registration.teamName,
                    pdfPath
                );

                if (emailSent) emailsSent++;
            }
        } else {
            // Individual registration
            const existingCert = await Certificate.findOne({
                where: {
                    eventId: event.id,
                    recipientEmail: registration.email,
                    certificateType: 'participant',
                },
            });

            if (existingCert) {
                return res.json({
                    success: true,
                    message: 'Certificate already issued',
                    data: existingCert,
                });
            }

            const credentialId = generateCredentialId();

            // Generate certificate PDF with QR code
            let certificateUrl = null;
            let pdfPath = null;
            try {
                const pdfResult = await generateCertificate({
                    participant: {
                        name: registration.name,
                        email: registration.email
                    },
                    event,
                    credentialId,
                    role: registration.participantRole || registration.categoryName || 'Participant',
                    achievement: achievement || null
                });

                certificateUrl = pdfResult.url;
                pdfPath = pdfResult.filepath;

                console.log('✅ Certificate PDF generated for:', registration.name);
            } catch (pdfError) {
                console.error('❌ Certificate PDF generation failed:', pdfError);
            }

            const cert = await Certificate.create({
                credentialId,
                eventId: event.id,
                recipientName: registration.name,
                recipientEmail: registration.email,
                userId: registration.userId,
                certificateType: 'participant',
                role: registration.participantRole || registration.categoryName || 'Participant',
                achievement: achievement || null,
                issuedBy: req.user.id,
                status: 'issued',
                certificateUrl
            });

            certificates.push(cert);

            // Send email with PDF
            const emailSent = await sendCertificateEmail(
                registration.email,
                registration.name,
                event,
                cert,
                null,
                pdfPath
            );

            if (emailSent) emailsSent++;
        }

        // Update registration
        await registration.update({
            certificateIssued: true,
            credentialId: certificates[0]?.credentialId,
            certificateIssuedAt: new Date(),
        });

        console.log(`✅ Issued ${certificates.length} certificate(s), sent ${emailsSent} email(s)`);

        return res.json({
            success: true,
            message: `Issued ${certificates.length} certificate(s). Email sent to ${emailsSent} recipient(s).`,
            data: {
                certificates,
                emailsSent,
                issuedBy: req.user.name
            }
        });
    } catch (error) {
        console.error('❌ Error issuing participant certificate:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to issue certificate',
            error: error.message
        });
    }
};

/**
 * @desc    Issue certificate to team member (organizer, volunteer, adjudicator, etc.)
 * @route   POST /api/certificates/team-member
 * @access  Private (Admin/President/GS only)
 */
exports.issueTeamMemberCertificate = async (req, res) => {
    try {
        const { eventId, participantIndex, achievement } = req.body;

        // Authorization check
        const allowedRoles = ['admin', 'president', 'general_secretary'];
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Only Admin, President, or General Secretary can issue certificates'
            });
        }

        const event = await Event.findByPk(eventId);
        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        const participant = event.participants[participantIndex];
        if (!participant) {
            return res.status(404).json({
                success: false,
                message: 'Participant not found'
            });
        }

        // Get participant details
        let recipientName = participant.name;
        let recipientEmail = null;
        let userId = null;

        if (participant.type === 'internal' && participant.userId) {
            const user = await User.findByPk(participant.userId);
            if (user) {
                recipientName = user.name;
                recipientEmail = user.email;
                userId = user.id;
            }
        } else {
            recipientName = participant.name;
            recipientEmail = participant.email;
        }

        if (!recipientEmail) {
            return res.status(400).json({
                success: false,
                message: 'Email required for certificate issuance. Please update participant information with email address.',
            });
        }

        // Check if certificate already exists
        const existingCert = await Certificate.findOne({
            where: {
                eventId: event.id,
                recipientEmail,
                certificateType: participant.role || 'volunteer',
            },
        });

        if (existingCert) {
            return res.json({
                success: true,
                message: 'Certificate already issued',
                data: existingCert,
            });
        }

        const credentialId = generateCredentialId();

        // Generate certificate PDF with QR code
        let certificateUrl = null;
        let pdfPath = null;
        try {
            const pdfResult = await generateCertificate({
                participant: {
                    name: recipientName,
                    email: recipientEmail
                },
                event,
                credentialId,
                role: participant.role || 'Team Member',
                designation: participant.designation,
                organization: participant.org,
                achievement: achievement || null
            });

            certificateUrl = pdfResult.url;
            pdfPath = pdfResult.filepath;

            console.log('✅ Certificate PDF generated for:', recipientName);
        } catch (pdfError) {
            console.error('❌ Certificate PDF generation failed:', pdfError);
        }

        const cert = await Certificate.create({
            credentialId,
            eventId: event.id,
            recipientName,
            recipientEmail,
            userId,
            certificateType: participant.role || 'volunteer',
            role: participant.role || 'Team Member',
            designation: participant.designation,
            organization: participant.org,
            achievement: achievement || null,
            issuedBy: req.user.id,
            status: 'issued',
            certificateUrl
        });

        // Update participant in event
        event.participants[participantIndex].certificateIssued = true;
        event.participants[participantIndex].credentialId = credentialId;
        event.participants[participantIndex].certificateIssuedAt = new Date();
        event.participants[participantIndex].certificateUrl = certificateUrl;
        await event.save();

        // Send email with PDF
        await sendCertificateEmail(
            recipientEmail,
            recipientName,
            event,
            cert,
            null,
            pdfPath
        );

        console.log(`✅ Certificate issued to team member: ${recipientName} (${participant.role})`);

        return res.json({
            success: true,
            message: 'Certificate issued successfully',
            data: {
                certificate: cert,
                issuedBy: req.user.name
            }
        });
    } catch (error) {
        console.error('❌ Error issuing team member certificate:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to issue certificate',
            error: error.message
        });
    }
};

/**
 * @desc    Bulk issue certificates for event (ALL participants + team members)
 * @route   POST /api/certificates/bulk-issue/:eventId
 * @access  Private (Admin/President/GS only)
 */
exports.bulkIssueCertificates = async (req, res) => {
    try {
        const { eventId } = req.params;
        const { recipientTypes, includeTeamMembers, includeParticipants } = req.body;

        // Authorization check
        const allowedRoles = ['admin', 'president', 'general_secretary'];
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Only Admin, President, or General Secretary can issue certificates'
            });
        }

        const event = await Event.findByPk(eventId);
        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        let issuedCount = 0;
        const results = {
            participants: 0,
            teamMembers: 0,
            emailsSent: 0,
            failed: [],
        };

        console.log(`🚀 Starting bulk certificate issuance for event: ${event.title}`);

        // ========== ISSUE CERTIFICATES FOR PARTICIPANTS ==========
        if (includeParticipants !== false) {
            const registrations = await EventRegistration.findAll({
                where: {
                    eventId,
                    status: 'confirmed',
                },
            });

            console.log(`📋 Found ${registrations.length} confirmed registrations`);

            for (const reg of registrations) {
                try {
                    if (reg.registrationType === 'team' && reg.teamMembers?.length > 0) {
                        // Team registration
                        for (const member of reg.teamMembers) {
                            const existingCert = await Certificate.findOne({
                                where: {
                                    eventId,
                                    recipientEmail: member.email || reg.email,
                                    certificateType: 'participant',
                                },
                            });

                            if (!existingCert) {
                                const credentialId = generateCredentialId();

                                // Generate PDF with QR code
                                let certificateUrl = null;
                                let pdfPath = null;
                                try {
                                    const pdfResult = await generateCertificate({
                                        participant: {
                                            name: member.name,
                                            email: member.email || reg.email
                                        },
                                        event,
                                        credentialId,
                                        role: 'Team Member',
                                        teamName: reg.teamName
                                    });

                                    certificateUrl = pdfResult.url;
                                    pdfPath = pdfResult.filepath;
                                } catch (pdfError) {
                                    console.error('❌ PDF generation failed for:', member.name);
                                }

                                const cert = await Certificate.create({
                                    credentialId,
                                    eventId,
                                    recipientName: member.name,
                                    recipientEmail: member.email || reg.email,
                                    userId: member.userId || reg.userId,
                                    certificateType: 'participant',
                                    role: 'Team Member',
                                    teamName: reg.teamName,
                                    issuedBy: req.user.id,
                                    status: 'issued',
                                    certificateUrl
                                });

                                // Send email
                                const emailSent = await sendCertificateEmail(
                                    member.email || reg.email,
                                    member.name,
                                    event,
                                    cert,
                                    reg.teamName,
                                    pdfPath
                                );

                                if (emailSent) results.emailsSent++;

                                results.participants++;
                                issuedCount++;
                            }
                        }
                    } else {
                        // Individual registration
                        const existingCert = await Certificate.findOne({
                            where: {
                                eventId,
                                recipientEmail: reg.email,
                                certificateType: 'participant',
                            },
                        });

                        if (!existingCert) {
                            const credentialId = generateCredentialId();

                            // Generate PDF with QR code
                            let certificateUrl = null;
                            let pdfPath = null;
                            try {
                                const pdfResult = await generateCertificate({
                                    participant: {
                                        name: reg.name,
                                        email: reg.email
                                    },
                                    event,
                                    credentialId,
                                    role: reg.participantRole || reg.categoryName || 'Participant'
                                });

                                certificateUrl = pdfResult.url;
                                pdfPath = pdfResult.filepath;
                            } catch (pdfError) {
                                console.error('❌ PDF generation failed for:', reg.name);
                            }

                            const cert = await Certificate.create({
                                credentialId,
                                eventId,
                                recipientName: reg.name,
                                recipientEmail: reg.email,
                                userId: reg.userId,
                                certificateType: 'participant',
                                role: reg.participantRole || reg.categoryName || 'Participant',
                                issuedBy: req.user.id,
                                status: 'issued',
                                certificateUrl
                            });

                            // Send email
                            const emailSent = await sendCertificateEmail(
                                reg.email,
                                reg.name,
                                event,
                                cert,
                                null,
                                pdfPath
                            );

                            if (emailSent) results.emailsSent++;

                            results.participants++;
                            issuedCount++;
                        }
                    }

                    await reg.update({
                        certificateIssued: true,
                        certificateIssuedAt: new Date()
                    });

                } catch (error) {
                    results.failed.push({
                        type: 'participant',
                        email: reg.email,
                        error: error.message
                    });
                    console.error(`❌ Failed to issue certificate for ${reg.email}:`, error.message);
                }
            }
        }

        // ========== ISSUE CERTIFICATES FOR TEAM MEMBERS ==========
        if (includeTeamMembers !== false && event.participants?.length > 0) {
            console.log(`👥 Found ${event.participants.length} team members`);

            for (const [index, participant] of event.participants.entries()) {
                // Filter by recipient types if provided
                if (recipientTypes && !recipientTypes.includes(participant.role)) {
                    continue;
                }

                try {
                    let recipientEmail = null;
                    let userId = null;
                    let recipientName = participant.name;

                    if (participant.type === 'internal' && participant.userId) {
                        const user = await User.findByPk(participant.userId);
                        if (user) {
                            recipientEmail = user.email;
                            userId = user.id;
                            recipientName = user.name;
                        }
                    } else {
                        recipientEmail = participant.email;
                    }

                    if (!recipientEmail) {
                        results.failed.push({
                            type: 'team_member',
                            name: participant.name,
                            error: 'No email available',
                        });
                        continue;
                    }

                    const existingCert = await Certificate.findOne({
                        where: {
                            eventId,
                            recipientEmail,
                            certificateType: participant.role || 'volunteer',
                        },
                    });

                    if (!existingCert) {
                        const credentialId = generateCredentialId();

                        // Generate PDF with QR code
                        let certificateUrl = null;
                        let pdfPath = null;
                        try {
                            const pdfResult = await generateCertificate({
                                participant: {
                                    name: recipientName,
                                    email: recipientEmail
                                },
                                event,
                                credentialId,
                                role: participant.role || 'Team Member',
                                designation: participant.designation,
                                organization: participant.org
                            });

                            certificateUrl = pdfResult.url;
                            pdfPath = pdfResult.filepath;
                        } catch (pdfError) {
                            console.error('❌ PDF generation failed for:', recipientName);
                        }

                        const cert = await Certificate.create({
                            credentialId,
                            eventId,
                            recipientName,
                            recipientEmail,
                            userId,
                            certificateType: participant.role || 'volunteer',
                            role: participant.role || 'Team Member',
                            designation: participant.designation,
                            organization: participant.org,
                            issuedBy: req.user.id,
                            status: 'issued',
                            certificateUrl
                        });

                        event.participants[index].certificateIssued = true;
                        event.participants[index].credentialId = credentialId;
                        event.participants[index].certificateIssuedAt = new Date();
                        event.participants[index].certificateUrl = certificateUrl;

                        // Send email
                        const emailSent = await sendCertificateEmail(
                            recipientEmail,
                            recipientName,
                            event,
                            cert,
                            null,
                            pdfPath
                        );

                        if (emailSent) results.emailsSent++;

                        results.teamMembers++;
                        issuedCount++;
                    }
                } catch (error) {
                    results.failed.push({
                        type: 'team_member',
                        name: participant.name,
                        error: error.message,
                    });
                    console.error(`❌ Failed to issue certificate for ${participant.name}:`, error.message);
                }
            }

            await event.save();
        }

        console.log(`✅ Bulk issuance complete: ${issuedCount} certificates issued, ${results.emailsSent} emails sent`);

        return res.json({
            success: true,
            message: `Issued ${issuedCount} certificate(s). Email sent to ${results.emailsSent} recipient(s).`,
            data: {
                ...results,
                totalIssued: issuedCount,
                issuedBy: req.user.name
            }
        });

    } catch (error) {
        console.error('❌ Error bulk issuing certificates:', error);
        return res.status(500).json({
            success: false,
            message: 'Bulk certificate issuance failed',
            error: error.message
        });
    }
};

// =====================================================
// QUERY & VERIFICATION
// =====================================================

/**
 * @desc    Get all certificates for an event
 * @route   GET /api/certificates/event/:eventId
 * @access  Private
 */
exports.getEventCertificates = async (req, res) => {
    try {
        const { eventId } = req.params;

        const certificates = await Certificate.findAll({
            where: { eventId },
            order: [['issuedAt', 'DESC']],
        });

        const event = await Event.findByPk(eventId, {
            attributes: ['id', 'title', 'date', 'location']
        });

        return res.json({
            success: true,
            count: certificates.length,
            data: {
                event,
                certificates,
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * @desc    Get user's certificates
 * @route   GET /api/certificates/my-certificates
 * @access  Private
 */
exports.getMyCertificates = async (req, res) => {
    try {
        const certificates = await Certificate.findAll({
            where: {
                [Op.or]: [
                    { userId: req.user.id },
                    { recipientEmail: req.user.email }
                ],
                status: 'issued',
            },
            order: [['issuedAt', 'DESC']],
        });

        // Attach event details
        const eventIds = [...new Set(certificates.map((c) => c.eventId))];
        const events = await Event.findAll({
            where: { id: { [Op.in]: eventIds } },
            attributes: ['id', 'title', 'date', 'location', 'bannerImage', 'image'],
        });

        const eventMap = new Map(events.map((e) => [e.id, e]));

        const enrichedCertificates = certificates.map((cert) => ({
            ...cert.toJSON(),
            event: eventMap.get(cert.eventId),
        }));

        return res.json({
            success: true,
            count: enrichedCertificates.length,
            data: enrichedCertificates,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * @desc    Verify certificate (Public - with QR code support)
 * @route   GET /api/certificates/verify/:credentialId
 * @access  Public
 */
exports.verifyCertificate = async (req, res) => {
    try {
        const { credentialId } = req.params;

        const certificate = await Certificate.findOne({
            where: { credentialId },
        });

        if (!certificate) {
            return res.status(404).json({
                success: false,
                message: 'Certificate not found or invalid',
            });
        }

        const event = await Event.findByPk(certificate.eventId, {
            attributes: ['id', 'title', 'date', 'location'],
        });

        return res.json({
            success: true,
            message: 'Certificate is valid and verified ✓',
            data: {
                certificate,
                event,
                isValid: certificate.status === 'issued',
                verifiedAt: new Date()
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Verification failed',
            error: error.message
        });
    }
};

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
    issueParticipantCertificate,
    issueTeamMemberCertificate,
    bulkIssueCertificates,
    getEventCertificates,
    getMyCertificates,
    verifyCertificate,
};
