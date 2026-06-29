import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Multipart } from '@fastify/multipart';
import { FastifyRequest } from 'fastify';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { FavoriteProductDto } from './dto/favorite-product.dto';
import { ListMyProductsDto } from './dto/list-my-products.dto';
import { ListProductsDto } from './dto/list-products.dto';
import { SearchProductsDto } from './dto/search-products.dto';
import { UpdateProductStatusDto } from './dto/update-product-status.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';
import { ProductImageUpload } from './types/product-image-upload.type';
import {
  PaginatedProductsResponse,
  ProductImageResponse,
  ProductResponse,
} from './types/product-response.type';

@Controller('products')
export class ProductsController {
  constructor(
    @Inject(ProductsService)
    private readonly productsService: ProductsService,
  ) {}

  @Get()
  listProducts(@Query() query: ListProductsDto): Promise<PaginatedProductsResponse> {
    return this.productsService.listProducts(query);
  }

  @Get('search')
  searchProducts(
    @Query() query: SearchProductsDto,
  ): Promise<PaginatedProductsResponse> {
    return this.productsService.searchProducts(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  listMyProducts(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListMyProductsDto,
  ): Promise<PaginatedProductsResponse> {
    return this.productsService.listMyProducts(user.id, query);
  }

  @Get(':id')
  getProduct(@Param('id', ParseUUIDPipe) id: string): Promise<ProductResponse> {
    return this.productsService.getProduct(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  createProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProductDto,
  ): Promise<ProductResponse> {
    return this.productsService.createProduct(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  updateProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductResponse> {
    return this.productsService.updateProduct(id, user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  deleteProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ id: string; deleted: true }> {
    return this.productsService.deleteProduct(id, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/status')
  updateProductStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProductStatusDto,
  ): Promise<ProductResponse> {
    return this.productsService.updateProductStatus(id, user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/images')
  async uploadProductImages(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
  ): Promise<ProductImageResponse[]> {
    const files = await this.extractImageFiles(request);
    return this.productsService.uploadProductImages(id, user.id, files);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/favorite')
  toggleFavorite(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() _dto: FavoriteProductDto,
  ): Promise<{ favorited: boolean }> {
    void _dto;
    return this.productsService.toggleFavorite(id, user.id);
  }

  private async extractImageFiles(
    request: FastifyRequest,
  ): Promise<ProductImageUpload[]> {
    const files: ProductImageUpload[] = [];

    try {
      for await (const part of request.parts()) {
        if (part.type !== 'file') {
          throw new BadRequestException('Only image files are allowed');
        }

        files.push(await this.toImageUpload(part));
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Invalid image upload');
    }

    return files;
  }

  private async toImageUpload(
    part: Extract<Multipart, { type: 'file' }>,
  ): Promise<ProductImageUpload> {
    return {
      originalName: part.filename,
      mimeType: part.mimetype,
      buffer: await part.toBuffer(),
    };
  }
}
