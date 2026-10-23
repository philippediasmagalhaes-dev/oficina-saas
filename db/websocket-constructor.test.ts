import { describe, expect, it } from "vitest";
import { selectWebSocketConstructor } from "./websocket-constructor";

describe("selectWebSocketConstructor", () => {
  it("prefere o WebSocket nativo quando o runtime oferece um", () => {
    class NativeWebSocket {}
    class NodeWebSocket {}

    expect(
      selectWebSocketConstructor(NativeWebSocket, NodeWebSocket),
    ).toBe(NativeWebSocket);
  });

  it("usa o fallback do Node quando o runtime não oferece WebSocket", () => {
    class NodeWebSocket {}

    expect(selectWebSocketConstructor(undefined, NodeWebSocket)).toBe(
      NodeWebSocket,
    );
  });
});
