import pino from "pino";

const logger = pino();

export const sendSms = async (to: string, content: string) => {
  const res: any = await (
    await fetch("https://api.httpsms.com/v1/messages/send", {
      method: "POST",
      headers: {
        "x-api-key": process.env.HTTPSMS_API_KEY as string,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content,
        from: process.env.SMS_FROM,
        to,
      }),
    })
  ).json();
  if (res.status !== "success") {
    logger.error(res);
    throw new Error("Queueing SMS was not successful");
  }
};
