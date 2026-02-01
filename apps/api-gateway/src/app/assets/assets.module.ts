import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetEntity, FolderEntity } from '@project-bubble/db-layer';
import { AssetsService } from './assets.service';
import { FoldersService } from './folders.service';
import { AssetsController } from './assets.controller';
import { FoldersController } from './folders.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AssetEntity, FolderEntity])],
  controllers: [AssetsController, FoldersController],
  providers: [AssetsService, FoldersService],
  exports: [AssetsService, FoldersService],
})
export class AssetsModule {}
