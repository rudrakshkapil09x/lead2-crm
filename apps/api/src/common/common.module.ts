import { Global, Module } from "@nestjs/common";
import { CryptoService } from "./crypto.service";
import { AuthGuard } from "./auth.guard";
@Global()
@Module({
  providers: [CryptoService, AuthGuard],
  exports: [CryptoService, AuthGuard],
})
export class CommonModule {}
