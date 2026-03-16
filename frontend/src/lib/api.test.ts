import { ApiError } from "./api";

describe("ApiError", () => {
  it("stores status, body, and message", () => {
    const error = new ApiError(404, { detail: "not found" }, "Not Found");

    expect(error.status).toBe(404);
    expect(error.body).toEqual({ detail: "not found" });
    expect(error.message).toBe("Not Found");
    expect(error.name).toBe("ApiError");
  });

  it("is an instance of Error", () => {
    const error = new ApiError(500, null, "Server Error");
    expect(error).toBeInstanceOf(Error);
  });
});
