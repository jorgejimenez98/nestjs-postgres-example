import {
  Logger,
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common'
import { DataSource, Repository } from 'typeorm'
import { InjectRepository } from '@nestjs/typeorm'
import { Product } from './entities/product.entity'
import { CreateProductDto } from './dto/create-product.dto'
import { UpdateProductDto } from './dto/update-product.dto'
import { PaginationDto } from '../common/dtos/pagination.dto'
import { validate as isUUID } from 'uuid'
import { ProductImage } from './entities/product-image.entity'

@Injectable()
export class ProductsService {
  private readonly logger = new Logger('ProductsService')

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,

    @InjectRepository(ProductImage)
    private readonly productImageRepository: Repository<ProductImage>,

    private dataSource: DataSource,
  ) {}

  async create(createProductDto: CreateProductDto) {
    try {
      const { images = [], ...productDetails } = createProductDto
      const product = this.productRepository.create({
        ...productDetails,
        images: images.map((image) =>
          this.productImageRepository.create({ url: image }),
        ),
      })
      await this.productRepository.save(product)
      return { ...product, images }
    } catch (error) {
      this.handleDBExpections(error)
    }
  }

  async findAll(paginationDto: PaginationDto) {
    const { limit = 10, offset = 0 } = paginationDto
    const products = await this.productRepository.find({
      take: limit,
      skip: offset,
      relations: { images: true }, // Send relation on response
    })
    return products.map((p) => ({ ...p, images: p.images.map((i) => i.url) }))
  }

  async findOne(term: string): Promise<Product> {
    let product: Product
    if (isUUID(term)) {
      product = await this.productRepository.findOneBy({ id: term })
    } else {
      // product = await this.productRepository.findOneBy({ slug: term })
      const queryBuilder = this.productRepository.createQueryBuilder('prod')
      product = await queryBuilder
        .where(`UPPER(title) =:title or slug =:slug`, {
          title: term.toUpperCase(),
          slug: term.toLowerCase(),
        })
        .leftJoinAndSelect('prod.images', 'prodImages') // Send relation on query Builder
        .getOne()
    }
    if (!product) throw new NotFoundException(`Product with ${term} not found`)
    return product
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const { images, ...rest } = updateProductDto

    const product = await this.productRepository.preload({ id, ...rest })
    if (!product) throw new NotFoundException(`Product with id ${id} not found`)

    // Create Images with Query Runner
    const queryRunner = this.dataSource.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()

    try {
      // Borrar las imagenes anteriores
      if (images) {
        await queryRunner.manager.delete(ProductImage, { product: { id } })
         // Insertar Nuevas Imagenes
        product.images = images.map((url) =>
          this.productImageRepository.create({ url: url }),
        )
      }
      await queryRunner.manager.save(product)
      await queryRunner.commitTransaction()
      await queryRunner.release()
      return this.findOnePlain(id)
    } catch (error) {
      await queryRunner.rollbackTransaction()
      await queryRunner.release()
      this.handleDBExpections(error)
    }
  }

  async remove(id: string) {
    const product = await this.findOne(id)
    await this.productRepository.remove(product)
  }

  private handleDBExpections(error: any) {
    if (error?.code === '23505') {
      throw new BadRequestException(error?.detail)
    }
    this.logger.error(error)
    throw new InternalServerErrorException(
      'Unexpected Error, check server logs',
    )
  }

  async findOnePlain(term: string) {
    const { images = [], ...rest } = await this.findOne(term)
    return {
      ...rest,
      images: images.map((i) => i.url),
    }
  }
}
