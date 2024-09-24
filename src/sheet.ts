import pino from "pino";

const logger = pino();

export const fetchActiveRecipients = async (): Promise<RecipientRow[]> => {
  const response = await (
    await fetch(`${process.env.RECIPIENTS_URL}?_format=records`)
  ).json();

  return response
    .map(
      (r: any, rowIndex: number): RecipientRow => ({
        rowIndex,
        number: `+${r.number}`,
        name: r.name,
        active: r.number?.length > 0 && r.active === "TRUE",
        level: r.level,
      })
    )
    .filter((r: RecipientRow) => r.active);
};
export const fetchActiveMessages = async (): Promise<MessageRow[]> => {
  const response = await (await fetch(process.env.MESSAGES_URL)).json();

  return response
    .map(
      (r: any): MessageRow => ({
        level: r.level,
        active: r.level > 0 && r.active === "TRUE",
        caption: r.caption,
        content: r.content,
        type: r.type,
      })
    )
    .filter((r) => r.active)
    .sort((a: MessageRow, b: MessageRow) => a.level - b.level);
};

export type RecipientRow = {
  rowIndex: number;
  number: string;
  name: string;
  active: boolean;
  level: number;
};

export type MessageRow = {
  active: boolean;
  caption: string;
  content: string;
  type: "prompt" | "template";
  level: number;
};

export const updateRecipient = async (
  rowIndex: number,
  level: number,
  lastCaption: string,
  lastContent: string
) => {
  logger.info(`PATCH ${process.env.RECIPIENTS_URL}/${rowIndex}`);
  const result = await (
    await fetch(`${process.env.RECIPIENTS_URL}/${rowIndex}`, {
      method: "PATCH",
      mode: "cors",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        level,
        lastCaption,
        lastContent,
      }),
    })
  ).json();
  if (result.detail) {
    throw new Error(result.detail);
  }
  console.log(result);
};
