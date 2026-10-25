import { expect, it } from "vitest";
import { umamiSendRequest } from "./umami-send";

const SEND_URL = "https://stats.example.com/api/send";

function send(body: string, headers: Record<string, string> = {}) {
  return new Request("https://blog.example.com/api/send", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

it("puts the visitor's IP into the event payload", async () => {
  const forwarded = await umamiSendRequest(
    send(
      JSON.stringify({
        type: "event",
        payload: { website: "site-id", url: "/posts/a" },
      }),
      { "cf-connecting-ip": "203.0.113.7", "user-agent": "Firefox" },
    ),
    SEND_URL,
  );

  expect(forwarded.url).toBe(SEND_URL);
  expect(forwarded.method).toBe("POST");
  expect(forwarded.headers.get("user-agent")).toBe("Firefox");
  expect(await forwarded.json()).toEqual({
    type: "event",
    payload: { website: "site-id", url: "/posts/a", ip: "203.0.113.7" },
  });
});

it("passes a body that is not an Umami event through unchanged", async () => {
  for (const body of ["not json", "[1,2]", '{"type":"event"}']) {
    const forwarded = await umamiSendRequest(
      send(body, { "cf-connecting-ip": "203.0.113.7" }),
      SEND_URL,
    );
    expect(await forwarded.text()).toBe(body);
  }
});

it("forwards untouched when there is no visitor IP", async () => {
  const body = JSON.stringify({ type: "event", payload: { url: "/" } });
  const forwarded = await umamiSendRequest(send(body), SEND_URL);

  expect(forwarded.url).toBe(SEND_URL);
  expect(await forwarded.text()).toBe(body);
});
