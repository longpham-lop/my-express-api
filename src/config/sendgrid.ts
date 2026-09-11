import sgMail from "@sendgrid/mail";

const apiKey = process.env.SENDGRID_API_KEY?.trim();

// Reservation creation still works in local development without email settings.
if (apiKey) {
  sgMail.setApiKey(apiKey);
}

export const isEmailDeliveryConfigured = () => Boolean(
  apiKey && process.env.SENDGRID_FROM_EMAIL?.trim()
);

export default sgMail; 



