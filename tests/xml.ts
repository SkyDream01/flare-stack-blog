import { SaxesParser } from "saxes";

export type XmlElement = {
  name: string;
  attributes: Record<string, string>;
  children: Array<XmlElement>;
  /** Text and CDATA directly inside the element, concatenated. */
  text: string;
};

/**
 * Parses `xml` with a strict XML 1.0 parser (saxes, the one behind jsdom) and
 * returns the root element. It throws on anything a feed reader's parser may
 * refuse: a character XML forbids, a stray `]]>` or `&`, an unclosed or
 * second root element.
 */
export function parseXml(xml: string): XmlElement {
  const parser = new SaxesParser();
  const stack: Array<XmlElement> = [];
  let root: XmlElement | undefined;

  parser.on("error", (error) => {
    throw error;
  });
  parser.on("opentag", (tag) => {
    const element: XmlElement = {
      name: tag.name,
      attributes: Object.fromEntries(
        Object.entries(tag.attributes).map(([key, value]) => [
          key,
          String(value),
        ]),
      ),
      children: [],
      text: "",
    };
    const parent = stack.at(-1);
    if (parent) parent.children.push(element);
    else root = element;
    stack.push(element);
  });
  parser.on("closetag", () => {
    stack.pop();
  });
  const addText = (text: string) => {
    const current = stack.at(-1);
    if (current) current.text += text;
  };
  parser.on("text", addText);
  parser.on("cdata", addText);

  parser.write(xml).close();
  if (!root) throw new Error("The document has no root element");
  return root;
}

/** The child elements of `element` named `name`. */
export function childrenNamed(element: XmlElement, name: string) {
  return element.children.filter((child) => child.name === name);
}

/** The first child of `element` named `name`. */
export function childNamed(element: XmlElement, name: string) {
  const child = childrenNamed(element, name)[0];
  if (!child) throw new Error(`Expected <${name}> in <${element.name}>`);
  return child;
}

/**
 * Text that a feed reader shows for an HTML-escaped plain-text field: the five
 * entities `escapeCodeHtml` writes, decoded.
 */
export function unescapeBasicHtml(html: string) {
  return html
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&");
}
