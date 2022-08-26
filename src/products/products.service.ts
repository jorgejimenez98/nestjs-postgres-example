import {
  Logger,
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common'
import { Repository } from 'typeorm'
import { InjectRepository } from '@nestjs/typeorm'
import { Product } from './entities/product.entity'
import { CreateProductDto } from './dto/create-product.dto'
import { UpdateProductDto } from './dto/update-product.dto'
import { PaginationDto } from '../common/dtos/pagination.dto'
import { validate as isUUID } from 'uuid'

@Injectable()
export class ProductsService {
  private readonly logger = new Logger('ProductsService')

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async create(createProductDto: CreateProductDto) {
    try {
      const product = this.productRepository.create(createProductDto)
      await this.productRepository.save(product)
      return product
    } catch (error) {
      this.handleDBExpections(error)
    }
  }

  findAll(paginationDto: PaginationDto) {
    const { limit = 10, offset = 0 } = paginationDto
    return this.productRepository.find({ take: limit, skip: offset })
  }

  async findOne(term: string): Promise<Product> {
    let product: Product
    if (isUUID(term)) {
      product = await this.productRepository.findOneBy({ id: term })
    } else {
      product = await this.productRepository.findOneBy({ slug: term })
    }
    if (!product) throw new NotFoundException(`Product with ${term} not found`)
    return product
  }

  update(id: number, updateProductDto: UpdateProductDto) {
    return `This action updates a #${id} product`
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
}
