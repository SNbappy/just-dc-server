// services/pdfService.js
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

/**
 * Generate registration receipt PDF
 * @param {Object} data - Registration data
 * @param {Object} data.registration - EventRegistration instance
 * @param {Object} data.event - Event instance
 * @param {Object} data.payment - Payment instance (if paid)
 */
exports.generateRegistrationReceipt = async (data) => {
    const { registration, event, payment } = data;

    return new Promise(async (resolve, reject) => {
        try {
            // Create uploads directory if not exists
            const uploadDir = path.join(__dirname, '../uploads/receipts');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            // Generate filename
            const filename = `receipt_${registration.registrationId || registration.id}_${Date.now()}.pdf`;
            const filepath = path.join(uploadDir, filename);

            // Create PDF document
            const doc = new PDFDocument({
                size: 'A4',
                margins: { top: 50, bottom: 50, left: 50, right: 50 }
            });

            // Pipe to file
            const stream = fs.createWriteStream(filepath);
            doc.pipe(stream);

            // Header - Club Name
            doc.fontSize(24)
                .font('Helvetica-Bold')
                .fillColor('#667eea')
                .text('JUST DEBATE CLUB', { align: 'center' });

            doc.fontSize(16)
                .font('Helvetica')
                .fillColor('#333333')
                .text('REGISTRATION CONFIRMATION', { align: 'center' });

            doc.moveDown(1);

            // Divider line
            doc.strokeColor('#667eea')
                .lineWidth(2)
                .moveTo(50, doc.y)
                .lineTo(545, doc.y)
                .stroke();

            doc.moveDown(1);

            // Event Information Section
            doc.fontSize(14)
                .font('Helvetica-Bold')
                .fillColor('#667eea')
                .text('EVENT DETAILS', { underline: true });

            doc.moveDown(0.5);

            doc.fontSize(11)
                .font('Helvetica-Bold')
                .fillColor('#333333')
                .text('Event: ', { continued: true })
                .font('Helvetica')
                .text(event.title);

            doc.font('Helvetica-Bold')
                .text('Date: ', { continued: true })
                .font('Helvetica')
                .text(new Date(event.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }));

            doc.font('Helvetica-Bold')
                .text('Time: ', { continued: true })
                .font('Helvetica')
                .text(event.time);

            doc.font('Helvetica-Bold')
                .text('Venue: ', { continued: true })
                .font('Helvetica')
                .text(event.location);

            doc.moveDown(1);

            // Registration Details Section
            doc.fontSize(14)
                .font('Helvetica-Bold')
                .fillColor('#667eea')
                .text('REGISTRATION DETAILS', { underline: true });

            doc.moveDown(0.5);

            doc.fontSize(11)
                .font('Helvetica-Bold')
                .fillColor('#333333')
                .text('Registration ID: ', { continued: true })
                .font('Helvetica')
                .text(registration.registrationId || `REG-${registration.id}`);

            doc.font('Helvetica-Bold')
                .text('Type: ', { continued: true })
                .font('Helvetica')
                .text(registration.registrationType === 'team' ? 'Team Registration' : 'Individual Registration');

            if (registration.categoryName) {
                doc.font('Helvetica-Bold')
                    .text('Category: ', { continued: true })
                    .font('Helvetica')
                    .text(registration.categoryName);
            }

            doc.moveDown(0.5);

            // Participant Information
            if (registration.registrationType === 'team' && registration.teamName) {
                doc.fontSize(14)
                    .font('Helvetica-Bold')
                    .fillColor('#667eea')
                    .text('TEAM INFORMATION', { underline: true });

                doc.moveDown(0.5);

                doc.fontSize(11)
                    .font('Helvetica-Bold')
                    .fillColor('#333333')
                    .text('Team Name: ', { continued: true })
                    .font('Helvetica')
                    .text(registration.teamName);

                doc.moveDown(0.3);

                doc.font('Helvetica-Bold')
                    .text('Team Captain:');

                doc.font('Helvetica')
                    .text(`  Name: ${registration.name}`)
                    .text(`  Email: ${registration.email}`)
                    .text(`  Phone: ${registration.phone || 'N/A'}`);

                // Team Members
                if (registration.teamMembers && registration.teamMembers.length > 0) {
                    doc.moveDown(0.3);
                    doc.font('Helvetica-Bold')
                        .text('Team Members:');

                    registration.teamMembers.forEach((member, index) => {
                        doc.font('Helvetica')
                            .text(`  ${index + 2}. ${member.name}`)
                            .text(`     Email: ${member.email}`)
                            .text(`     Phone: ${member.phone || 'N/A'}`);
                    });
                }
            } else {
                // Individual Registration
                doc.fontSize(14)
                    .font('Helvetica-Bold')
                    .fillColor('#667eea')
                    .text('PARTICIPANT INFORMATION', { underline: true });

                doc.moveDown(0.5);

                doc.fontSize(11)
                    .font('Helvetica-Bold')
                    .fillColor('#333333')
                    .text('Name: ', { continued: true })
                    .font('Helvetica')
                    .text(registration.name);

                doc.font('Helvetica-Bold')
                    .text('Email: ', { continued: true })
                    .font('Helvetica')
                    .text(registration.email);

                doc.font('Helvetica-Bold')
                    .text('Phone: ', { continued: true })
                    .font('Helvetica')
                    .text(registration.phone || 'N/A');

                if (registration.studentId) {
                    doc.font('Helvetica-Bold')
                        .text('Student ID: ', { continued: true })
                        .font('Helvetica')
                        .text(registration.studentId);
                }

                if (registration.department) {
                    doc.font('Helvetica-Bold')
                        .text('Department: ', { continued: true })
                        .font('Helvetica')
                        .text(registration.department);
                }
            }

            doc.moveDown(1);

            // Payment Details Section
            if (payment || registration.amount > 0) {
                doc.fontSize(14)
                    .font('Helvetica-Bold')
                    .fillColor('#667eea')
                    .text('PAYMENT DETAILS', { underline: true });

                doc.moveDown(0.5);

                doc.fontSize(11)
                    .font('Helvetica-Bold')
                    .fillColor('#333333')
                    .text('Amount: ', { continued: true })
                    .font('Helvetica')
                    .text(`${registration.amount} BDT`);

                if (payment) {
                    doc.font('Helvetica-Bold')
                        .text('Payment Method: ', { continued: true })
                        .font('Helvetica')
                        .text(payment.paymentMethod || 'N/A');

                    if (payment.transactionId) {
                        doc.font('Helvetica-Bold')
                            .text('Transaction ID: ', { continued: true })
                            .font('Helvetica')
                            .text(payment.transactionId);
                    }

                    doc.font('Helvetica-Bold')
                        .text('Payment Date: ', { continued: true })
                        .font('Helvetica')
                        .text(payment.paidAt ? new Date(payment.paidAt).toLocaleString() : 'N/A');

                    doc.font('Helvetica-Bold')
                        .fillColor(payment.status === 'paid' ? '#28a745' : '#ffc107')
                        .text('Status: ', { continued: true })
                        .font('Helvetica')
                        .text(payment.status.toUpperCase());
                } else {
                    doc.font('Helvetica-Bold')
                        .fillColor('#ffc107')
                        .text('Status: ', { continued: true })
                        .font('Helvetica')
                        .text('PENDING PAYMENT');
                }
            } else {
                doc.fontSize(11)
                    .font('Helvetica-Bold')
                    .fillColor('#28a745')
                    .text('✓ FREE EVENT - No payment required');
            }

            doc.moveDown(1.5);

            // QR Code Section
            const qrData = JSON.stringify({
                registrationId: registration.registrationId || `REG-${registration.id}`,
                eventId: event.id,
                email: registration.email,
                type: registration.registrationType
            });

            const qrCodeImage = await QRCode.toDataURL(qrData, {
                width: 200,
                margin: 1
            });

            doc.fontSize(14)
                .font('Helvetica-Bold')
                .fillColor('#667eea')
                .text('CHECK-IN QR CODE', { align: 'center' });

            doc.moveDown(0.5);

            // Add QR code image
            const qrX = (doc.page.width - 150) / 2;
            doc.image(qrCodeImage, qrX, doc.y, { width: 150, height: 150 });

            doc.moveDown(8);

            doc.fontSize(9)
                .font('Helvetica')
                .fillColor('#666666')
                .text('Scan this QR code at the event entrance for check-in', { align: 'center' });

            doc.moveDown(1.5);

            // Important Notes
            doc.fontSize(12)
                .font('Helvetica-Bold')
                .fillColor('#333333')
                .text('IMPORTANT NOTES:', { underline: true });

            doc.moveDown(0.3);

            doc.fontSize(9)
                .font('Helvetica')
                .text('• Bring this receipt on event day (printed or digital)')
                .text('• Arrive at least 30 minutes early for registration')
                .text('• Carry a valid ID card')
                .text('• No refund after registration deadline')
                .text('• For queries, contact: justdebateclub2018@gmail.com');

            // Footer
            doc.moveDown(2);

            doc.fontSize(8)
                .font('Helvetica')
                .fillColor('#999999')
                .text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' })
                .text('JUST Debate Club © 2026', { align: 'center' });

            // Finalize PDF
            doc.end();

            // Wait for stream to finish
            stream.on('finish', () => {
                resolve({
                    filename,
                    filepath,
                    url: `/uploads/receipts/${filename}`
                });
            });

            stream.on('error', (error) => {
                reject(error);
            });

        } catch (error) {
            reject(error);
        }
    });
};

/**
 * Generate certificate PDF
 * @param {Object} data - Certificate data
 */
exports.generateCertificate = async (data) => {
    const { participant, event, credentialId, role } = data;

    return new Promise(async (resolve, reject) => {
        try {
            const uploadDir = path.join(__dirname, '../uploads/certificates');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            const filename = `certificate_${credentialId}_${Date.now()}.pdf`;
            const filepath = path.join(uploadDir, filename);

            const doc = new PDFDocument({
                size: 'A4',
                layout: 'landscape',
                margins: { top: 50, bottom: 50, left: 50, right: 50 }
            });

            const stream = fs.createWriteStream(filepath);
            doc.pipe(stream);

            // Certificate Border
            doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60)
                .lineWidth(3)
                .strokeColor('#667eea')
                .stroke();

            doc.rect(40, 40, doc.page.width - 80, doc.page.height - 80)
                .lineWidth(1)
                .strokeColor('#667eea')
                .stroke();

            doc.moveDown(2);

            // Certificate Title
            doc.fontSize(36)
                .font('Helvetica-Bold')
                .fillColor('#667eea')
                .text('CERTIFICATE', { align: 'center' });

            doc.fontSize(18)
                .font('Helvetica')
                .fillColor('#333333')
                .text('OF PARTICIPATION', { align: 'center' });

            doc.moveDown(2);

            // This is to certify
            doc.fontSize(14)
                .font('Helvetica')
                .text('This is to certify that', { align: 'center' });

            doc.moveDown(0.5);

            // Participant Name
            doc.fontSize(28)
                .font('Helvetica-Bold')
                .fillColor('#667eea')
                .text(participant.name, { align: 'center' });

            doc.moveDown(1);

            // Role
            doc.fontSize(14)
                .font('Helvetica')
                .fillColor('#333333')
                .text(`has successfully participated as ${role || 'Participant'}`, { align: 'center' });

            doc.moveDown(0.5);

            doc.text('in', { align: 'center' });

            doc.moveDown(0.5);

            // Event Name
            doc.fontSize(20)
                .font('Helvetica-Bold')
                .fillColor('#333333')
                .text(event.title, { align: 'center' });

            doc.moveDown(0.5);

            // Event Date
            doc.fontSize(12)
                .font('Helvetica')
                .text(`held on ${new Date(event.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                })}`, { align: 'center' });

            doc.moveDown(1);

            // Organized by
            doc.fontSize(11)
                .text('Organized by', { align: 'center' });

            doc.fontSize(14)
                .font('Helvetica-Bold')
                .text('JUST Debate Club', { align: 'center' });

            doc.moveDown(2);

            // Credential ID
            doc.fontSize(9)
                .font('Helvetica')
                .fillColor('#666666')
                .text(`Credential ID: ${credentialId}`, { align: 'center' });

            doc.text(`Issue Date: ${new Date().toLocaleDateString()}`, { align: 'center' });

            doc.text(`Verify at: ${process.env.CLIENT_URL}/verify-certificate/${credentialId}`, { align: 'center' });

            doc.end();

            stream.on('finish', () => {
                resolve({
                    filename,
                    filepath,
                    url: `/uploads/certificates/${filename}`
                });
            });

            stream.on('error', reject);

        } catch (error) {
            reject(error);
        }
    });
};
