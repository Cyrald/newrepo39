import { useState } from "react"
import { useRoute, useSearch } from "wouter"
import { SlidersHorizontal } from "lucide-react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ProductCard } from "@/components/product-card"
import { ProductGridSkeleton } from "@/components/loading-state"
import { EmptyState } from "@/components/empty-state"
import { ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { useProducts } from "@/hooks/useProducts"
import { useCategories } from "@/hooks/useCategories"

export default function CatalogPage() {
  const [, params] = useRoute("/catalog")
  const searchParams = useSearch()
  const urlParams = new URLSearchParams(searchParams)
  
  const [sortBy, setSortBy] = useState<"price_asc" | "price_desc" | "popularity" | "newest" | "rating">(
    (urlParams.get("sort") as any) || "newest"
  )
  const [priceRange, setPriceRange] = useState([0, 10000])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)

  const { data: categoriesData, isLoading: categoriesLoading } = useCategories()
  const { data: productsData, isLoading: productsLoading } = useProducts({
    categoryIds: selectedCategories.length > 0 ? selectedCategories : undefined,
    minPrice: priceRange[0],
    maxPrice: priceRange[1],
    sortBy: sortBy,
    page: currentPage,
    limit: 12,
  })

  const categories = categoriesData || []
  const products = productsData?.products || []
  const total = productsData?.total || 0
  const totalPages = productsData?.totalPages || 1
  const isLoading = productsLoading

  const handleCategoryToggle = (categoryId: string) => {
    setCurrentPage(1) // Reset BEFORE changing filter (React batches both updates)
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    )
  }

  const handlePriceRangeChange = (newRange: number[]) => {
    setCurrentPage(1) // Reset BEFORE changing filter
    setPriceRange(newRange)
  }

  const handleSortChange = (value: string) => {
    setCurrentPage(1) // Reset BEFORE changing sort
    setSortBy(value as typeof sortBy)
  }

  const FilterContent = () => (
    <div className="space-y-6">
      {/* Categories */}
      <div>
        <h3 className="mb-3 font-semibold">Категории</h3>
        <div className="space-y-2">
          {categories.map((category) => (
            <div key={category.id} className="flex items-center space-x-2">
              <Checkbox
                id={`category-${category.id}`}
                checked={selectedCategories.includes(category.id)}
                onCheckedChange={() => handleCategoryToggle(category.id)}
                data-testid={`checkbox-category-${category.id}`}
              />
              <Label
                htmlFor={`category-${category.id}`}
                className="text-sm font-normal cursor-pointer"
              >
                {category.name}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div>
        <h3 className="mb-3 font-semibold">Цена</h3>
        <div className="space-y-4">
          <Slider
            min={0}
            max={10000}
            step={100}
            value={priceRange}
            onValueChange={handlePriceRangeChange}
            data-testid="slider-price-range"
          />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{priceRange[0]} ₽</span>
            <span>{priceRange[1]} ₽</span>
          </div>
        </div>
      </div>

      {/* Reset Filters */}
      <Button
        variant="outline"
        className="w-full"
        onClick={() => {
          setCurrentPage(1) // Reset BEFORE clearing filters
          setSelectedCategories([])
          setPriceRange([0, 10000])
        }}
        data-testid="button-reset-filters"
      >
        Сбросить фильтры
      </Button>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          <h1 className="mb-8 font-serif text-3xl md:text-4xl font-semibold" data-testid="text-page-title">
            Каталог товаров
          </h1>

          <div className="flex flex-col gap-8 lg:flex-row">
            {/* Filters - Desktop */}
            <aside className="hidden lg:block w-64 shrink-0">
              <div className="sticky top-24 rounded-lg border bg-card p-6">
                <h2 className="mb-4 font-semibold">Фильтры</h2>
                <FilterContent />
              </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1">
              {/* Toolbar */}
              <div className="mb-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  {/* Filters - Mobile */}
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="outline" size="sm" className="lg:hidden" data-testid="button-show-filters">
                        <SlidersHorizontal className="mr-2 h-4 w-4" />
                        Фильтры
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left">
                      <SheetHeader>
                        <SheetTitle>Фильтры</SheetTitle>
                      </SheetHeader>
                      <div className="mt-6">
                        <FilterContent />
                      </div>
                    </SheetContent>
                  </Sheet>

                  <span className="text-sm text-muted-foreground">
                    Найдено: {total} {total === 1 ? 'товар' : total > 1 && total < 5 ? 'товара' : 'товаров'}
                  </span>
                </div>

                {/* Sort */}
                <Select value={sortBy} onValueChange={handleSortChange}>
                  <SelectTrigger className="w-[180px]" data-testid="select-sort">
                    <SelectValue placeholder="Сортировка" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Новые</SelectItem>
                    <SelectItem value="price_asc">Цена: по возрастанию</SelectItem>
                    <SelectItem value="price_desc">Цена: по убыванию</SelectItem>
                    <SelectItem value="popularity">Популярные</SelectItem>
                    <SelectItem value="rating">По рейтингу</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Products Grid */}
              {isLoading ? (
                <ProductGridSkeleton />
              ) : products.length === 0 ? (
                <EmptyState
                  icon={ShoppingBag}
                  title="Товары не найдены"
                  description="Попробуйте изменить параметры фильтрации или поиска"
                  action={{
                    label: "Сбросить фильтры",
                    onClick: () => {
                      setCurrentPage(1) // Reset BEFORE clearing filters
                      setSelectedCategories([])
                      setPriceRange([0, 10000])
                    },
                  }}
                />
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                    {products.map((product: any) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="mt-8 flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        data-testid="button-prev-page"
                      >
                        Предыдущая
                      </Button>
                      
                      <div className="flex gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter(page => {
                            if (totalPages <= 7) return true
                            if (page === 1 || page === totalPages) return true
                            if (page >= currentPage - 1 && page <= currentPage + 1) return true
                            return false
                          })
                          .map((page, index, array) => {
                            const prevPage = array[index - 1]
                            const showEllipsis = prevPage && page - prevPage > 1
                            
                            return (
                              <div key={page} className="flex items-center gap-1">
                                {showEllipsis && <span className="px-2 text-muted-foreground">...</span>}
                                <Button
                                  variant={currentPage === page ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setCurrentPage(page)}
                                  className="w-10"
                                  data-testid={`button-page-${page}`}
                                >
                                  {page}
                                </Button>
                              </div>
                            )
                          })}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        data-testid="button-next-page"
                      >
                        Следующая
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
