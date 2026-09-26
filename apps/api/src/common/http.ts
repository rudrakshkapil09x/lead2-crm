import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from "@nestjs/common";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { json } from "express";
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(e: any, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    let status = 500,
      message = "An unexpected error occurred. Please retry.";
    if (e instanceof HttpException) {
      status = e.getStatus();
      const b: any = e.getResponse();
      message = typeof b === "string" ? b : b.message;
    } else if (e.code === "23505") {
      status = 409;
      message = "This record already exists";
    } else if (
      ["22P02", "23503", "23514", "22003", "22007", "22008"].includes(e.code)
    ) {
      status = 400;
      message = "Invalid value or record relationship";
    }
    if (status === 500) console.error(e.message);
    res.status(status).json({ statusCode: status, message });
  }
}
export function configureApp(app: any) {
  app.setGlobalPrefix("api");
  app.use((req: any, res: any, next: any) => {
    if (
      String(req.headers["content-type"] || "")
        .toLowerCase()
        .startsWith("multipart/")
    ) {
      return res
        .status(415)
        .json({
          message: "Use JSON uploads; multipart requests are not accepted",
        });
    }
    next();
  });
  app.getHttpAdapter().getInstance().set("trust proxy", 1);
  app.use(json({ limit: "3mb" }));
  app.use(cookieParser());
  app.use(helmet());
  const origins = (process.env.CORS_ORIGIN || "http://localhost:3000")
    .split(",")
    .map((x) => x.trim());
  app.enableCors({ origin: origins, credentials: true });
  app.use((req: any, res: any, next: any) => {
    res.setHeader("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin &&
      !origins.includes(req.headers.origin)
    )
      return res.status(403).json({ message: "Origin not allowed" });
    next();
  });
  if (process.env.NODE_ENV !== "test")
    app.use(
      "/api/auth",
      rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 60,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        skip: (req: any) => req.method === "GET",
      }),
    );
  app.useGlobalFilters(new ApiExceptionFilter());
}
