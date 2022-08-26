import { Injectable } from '@nestjs/common'
import { ProductsService } from '../products/products.service'
import { initialData } from './data/seed-data'

@Injectable()
export class SeedService {
  constructor(private readonly productsService: ProductsService) {}

  async runSeed() {
    await this.insertNewProducts()
    return 'seed executed'
  }

  private async insertNewProducts() {
    await this.productsService.deleteAllProducts()
    const products = initialData.products
    const insertPromises = []
    products.forEach((p) => {
      insertPromises.push(this.productsService.create(p))
    })
    await Promise.all(insertPromises)
  }
}
