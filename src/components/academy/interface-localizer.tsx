import { useEffect } from "react";
import { localizeInterfaceText } from "@/lib/interface-localization";
import type { Locale } from "@/types/academy";

const originals = new WeakMap<Node, string>();
const attributes = ["placeholder", "aria-label", "title"] as const;

function localizeTree(root: Node, locale: Locale) {
  const localizeNode = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const original = originals.get(node) ?? node.textContent ?? "";
      if (!originals.has(node)) originals.set(node, original);
      const next = localizeInterfaceText(original, locale);
      if (node.textContent !== next) node.textContent = next;
      return;
    }
    if (!(node instanceof Element)) return;
    for (const attribute of attributes) {
      const current = node.getAttribute(attribute);
      if (!current) continue;
      const key = `data-original-${attribute}`;
      const original = node.getAttribute(key) ?? current;
      if (!node.hasAttribute(key)) node.setAttribute(key, original);
      node.setAttribute(attribute, localizeInterfaceText(original, locale));
    }
  };

  localizeNode(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) localizeNode(walker.currentNode);
}

export function InterfaceLocalizer({ locale }: { locale: Locale }) {
  useEffect(() => {
    document.documentElement.lang = locale === "ar" ? "ar" : "fr";
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    localizeTree(document.body, locale);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => localizeTree(node, locale));
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [locale]);
  return null;
}
