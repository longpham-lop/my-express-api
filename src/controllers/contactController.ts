import { Request, Response } from "express";
import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export const sendContact = async (
  req: Request,
  res: Response
) => {
  try {
    const { name, email, message } = req.body;

    await sgMail.send({
      to: "tuanlongp70@gmail.com",
      from: "tuanlongp70@gmail.com",

      replyTo: email,

      subject: `Phản hồi từ ${name}`,

      html: `
        <h2>Khách hàng gửi phản hồi</h2>

        <p>
          <b>Họ tên:</b> ${name}
        </p>

        <p>
          <b>Email:</b> ${email}
        </p>
        <p>
          <b>Loai phản hồi:</b> ${req.body.subject}
        </p>
        <p>
          <b>Nội dung:</b>
        </p>

        <div>
          ${message}
        </div>
      `,
    });

    return res.json({
      message: "Gửi phản hồi thành công",
    });
  } catch (err: any) {
  console.log(
    "SENDGRID ERROR:",
    err.response?.body || err
  );

  return res.status(500).json({
    message: "Lỗi gửi mail",
  });
}
};