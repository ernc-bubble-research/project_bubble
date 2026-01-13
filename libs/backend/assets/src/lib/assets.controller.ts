import { Controller, Post, UploadedFile, UseInterceptors, UseGuards, Req } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AssetsService } from './assets.service';
import { TenancyInterceptor, TransactionManager } from '@project_bubble/backend/infra';
import { AuthGuard } from '@nestjs/passport';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { EntityManager } from 'typeorm';
import { Request } from 'express';

@Controller('assets')
@UseGuards(AuthGuard('jwt'))
export class AssetsController {
    constructor(private assetsService: AssetsService) { }

    @Post('upload')
    @UseInterceptors(
        // 1. Transaction Interceptor (Sets RLS context)
        TenancyInterceptor,
        // 2. File Interceptor (Saves file to disk)
        FileInterceptor('file', {
            storage: diskStorage({
                destination: './uploads', // Simple local storage for prototype
                filename: (req, file, cb) => {
                    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                    cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
                },
            }),
        })
    )
    async uploadFile(
        @UploadedFile() file: Express.Multer.File,
        @Req() req: any,
        @TransactionManager() manager: EntityManager
    ) {
        // Note: Request user is populated by AuthGuard ('jwt')
        // Tenant Context is set by TenancyInterceptor reading req.user.tenantId

        return this.assetsService.createAsset(
            file.originalname,
            file.path,
            file.mimetype,
            req.user.tenantId,
            manager
        );
    }
}
