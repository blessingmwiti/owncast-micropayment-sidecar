import type { NextFunction, Request, Response } from "express";

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) {
    return {};
  }

  return Object.fromEntries(
    header.split(";").map((cookie) => {
      const [name, ...value] = cookie.trim().split("=");
      return [name, decodeURIComponent(value.join("="))];
    })
  );
}

function tokenFromRequest(req: Request): string | undefined {
  const queryToken =
    typeof req.query.token === "string" ? req.query.token : undefined;
  const headerToken = req.header("x-payflow-admin-token") ?? undefined;
  const cookieToken = parseCookies(req.header("cookie")).payflow_admin_token;

  return headerToken ?? queryToken ?? cookieToken;
}

export function requireAdminToken(expectedToken?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!expectedToken) {
      next();
      return;
    }

    const token = tokenFromRequest(req);

    if (token !== expectedToken) {
      res.status(401).json({
        ok: false,
        error: "admin_token_required"
      });
      return;
    }

    if (typeof req.query.token === "string") {
      res.cookie("payflow_admin_token", req.query.token, {
        httpOnly: true,
        sameSite: "lax",
        secure: req.secure
      });
    }

    next();
  };
}
