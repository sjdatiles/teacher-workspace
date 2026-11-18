import { describe, expect, it } from "vitest";
import {
  detectType,
  hostLabel,
  normalizeUrl,
  parseTags,
  validateFolderName,
  validateResource,
  validateUrl,
} from "./rules";

describe("normalizeUrl", () => {
  it("adds https:// to a bare address", () => {
    expect(normalizeUrl("deped.gov.ph/x")).toBe("https://deped.gov.ph/x");
    expect(normalizeUrl("  example.com ")).toBe("https://example.com");
  });
  it("keeps real schemes and leaves bad ones to validation", () => {
    expect(normalizeUrl("http://a.com")).toBe("http://a.com");
    expect(normalizeUrl("javascript:alert(1)")).toBe("javascript:alert(1)");
    expect(normalizeUrl("")).toBe("");
  });
  it("treats host:port as an address, not a scheme", () => {
    expect(normalizeUrl("localhost:3000")).toBe("https://localhost:3000");
  });
});

describe("validateUrl", () => {
  it("accepts http and https links", () => {
    expect(validateUrl("https://drive.google.com/file/d/1/view?usp=sharing")).toBeNull();
    expect(validateUrl("http://example.com")).toBeNull();
  });
  it.each([
    "javascript:alert(1)",
    "data:text/html,hi",
    "ftp://a.com",
    "file:///etc/passwd",
    "https://",
    "https://nodot",
    "https://a b.com",
    "",
  ])("rejects %s", (u) => expect(validateUrl(u)).not.toBeNull());
  it("rejects very long links", () =>
    expect(validateUrl(`https://a.com/${"x".repeat(2000)}`)).not.toBeNull());
});

describe("detectType", () => {
  it("guesses from the host", () => {
    expect(detectType("https://drive.google.com/x")).toBe("google_drive");
    expect(detectType("https://docs.google.com/document/d/1")).toBe("document");
    expect(detectType("https://www.youtube.com/watch?v=1")).toBe("video");
    expect(detectType("https://youtu.be/abc")).toBe("video");
    expect(detectType("https://en.wikipedia.org/wiki/Atom")).toBe("reference");
    expect(detectType("https://teacher.deped.gov.ph")).toBe("website");
    expect(detectType("nonsense")).toBe("website");
  });
});

describe("hostLabel / parseTags", () => {
  it("shows the host without www", () =>
    expect(hostLabel("https://www.khanacademy.org/math")).toBe("khanacademy.org"));
  it("cleans tags", () =>
    expect(parseTags(" Math, math ,, Grade 7 ")).toEqual(["math", "grade 7"]));
});

describe("validateResource / validateFolderName", () => {
  const ok = {
    title: "DepEd",
    url: "https://teacher.deped.gov.ph",
    description: "",
    type: "website",
    tags: [],
  };
  it("accepts a valid resource", () => expect(validateResource(ok)).toEqual({}));
  it("flags each problem", () => {
    const e = validateResource({
      title: " ",
      url: "x y",
      description: "d".repeat(501),
      type: "pdf",
      tags: Array(11).fill("a"),
    });
    expect(Object.keys(e).sort()).toEqual(["description", "tags", "title", "type", "url"]);
  });
  it("limits tag length", () =>
    expect(validateResource({ ...ok, tags: ["x".repeat(31)] }).tags).toBeDefined());
  it("checks folder names", () => {
    expect(validateFolderName("  ")).not.toBeNull();
    expect(validateFolderName("x".repeat(61))).not.toBeNull();
    expect(validateFolderName("Grade 7 Science")).toBeNull();
  });
});
