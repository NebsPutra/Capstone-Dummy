import { cookies, headers } from "next/headers";
import {
  LANG_COOKIE,
  isLang,
  translate,
  translateDynamic,
  type Lang,
  type TranslateVars,
  type TranslationKey,
} from "./translations";

/** Language for Server Components: saved cookie, else the browser's Accept-Language. */
export async function getServerLang(): Promise<Lang> {
  const cookieStore = await cookies();
  const saved = cookieStore.get(LANG_COOKIE)?.value;
  if (isLang(saved)) return saved;

  const accept = (await headers()).get("accept-language")?.toLowerCase() ?? "";
  return accept.startsWith("id") || accept.includes(",id") ? "id" : "en";
}

export async function getServerT() {
  const lang = await getServerLang();
  return {
    lang,
    t: (key: TranslationKey, vars?: TranslateVars) => translate(lang, key, vars),
    td: (key: string, fallback: string) => translateDynamic(lang, key, fallback),
  };
}
