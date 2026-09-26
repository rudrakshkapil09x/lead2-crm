import { Injectable, Logger, InternalServerErrorException } from "@nestjs/common";
import * as puppeteer from "puppeteer-core";
// @ts-ignore
import chromium from "@sparticuz/chromium";

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  async generatePdf(html: string): Promise<Buffer> {
    this.logger.debug("Generating PDF from HTML content...");
    let browser;
    try {
      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "load" });

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" }, // Margins are handled in the CSS
      });

      return Buffer.from(pdfBuffer);
    } catch (error) {
      this.logger.error("Failed to generate PDF", error);
      throw new InternalServerErrorException("Failed to generate PDF document");
    } finally {
      if (browser) {
        await browser.close().catch(console.error);
      }
    }
  }
}
