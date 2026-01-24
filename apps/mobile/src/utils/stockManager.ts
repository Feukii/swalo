import { getShopItem, setShopItem } from './storage';
import { Product, Category, DEFAULT_CATEGORIES } from '../types/stock';

const PRODUCTS_KEY = 'products';
const CATEGORIES_KEY = 'categories';

/**
 * Get all products from storage (shop-specific)
 */
export async function getProducts(): Promise<Product[]> {
  try {
    const data = await getShopItem(PRODUCTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading products:', error);
    return [];
  }
}

/**
 * Save products to storage (shop-specific)
 */
export async function saveProducts(products: Product[]): Promise<void> {
  try {
    await setShopItem(PRODUCTS_KEY, JSON.stringify(products));
  } catch (error) {
    console.error('Error saving products:', error);
    throw error;
  }
}

/**
 * Update product stock quantity
 */
export async function updateProductStock(productId: string, quantityChange: number): Promise<void> {
  try {
    const products = await getProducts();
    const updatedProducts = products.map(product => {
      if (product.id === productId) {
        return {
          ...product,
          stockQuantity: product.stockQuantity + quantityChange,
          updatedAt: new Date().toISOString(),
        };
      }
      return product;
    });
    await saveProducts(updatedProducts);
  } catch (error) {
    console.error('Error updating product stock:', error);
    throw error;
  }
}

/**
 * Update multiple products stock (for batch operations like sales)
 */
export async function updateMultipleProductsStock(
  updates: Array<{ productId: string; quantityChange: number }>
): Promise<void> {
  try {
    const products = await getProducts();
    const updatedProducts = products.map(product => {
      const update = updates.find(u => u.productId === product.id);
      if (update) {
        return {
          ...product,
          stockQuantity: product.stockQuantity + update.quantityChange,
          updatedAt: new Date().toISOString(),
        };
      }
      return product;
    });
    await saveProducts(updatedProducts);
  } catch (error) {
    console.error('Error updating multiple products stock:', error);
    throw error;
  }
}

/**
 * Initialize products with default mock data if empty
 */
export async function initializeDefaultProducts(): Promise<void> {
  const existingProducts = await getProducts();
  if (existingProducts.length === 0) {
    const defaultProducts: Product[] = [
      {
        id: '1',
        reference: 'PRD001',
        name: 'Eau minérale 1.5L',
        category: 'boissons',
        stockQuantity: 45,
        stockThreshold: 20,
        unit: 'unité',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '2',
        reference: 'PRD002',
        name: 'Riz 5kg',
        category: 'alimentation',
        stockQuantity: 30,
        stockThreshold: 10,
        unit: 'sac',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '3',
        reference: 'PRD003',
        name: 'Savon Palmolive',
        category: 'hygiene',
        stockQuantity: 25,
        stockThreshold: 15,
        unit: 'unité',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    await saveProducts(defaultProducts);
  }
}

// ============= CATEGORY MANAGEMENT =============

/**
 * Get all categories from storage (shop-specific)
 */
export async function getCategories(): Promise<Category[]> {
  try {
    const data = await getShopItem(CATEGORIES_KEY);
    if (data) {
      return JSON.parse(data);
    }
    // Return default categories if none exist
    return DEFAULT_CATEGORIES.map(cat => ({
      ...cat,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
  } catch (error) {
    console.error('Error loading categories:', error);
    return DEFAULT_CATEGORIES;
  }
}

/**
 * Save categories to storage (shop-specific)
 */
export async function saveCategories(categories: Category[]): Promise<void> {
  try {
    await setShopItem(CATEGORIES_KEY, JSON.stringify(categories));
  } catch (error) {
    console.error('Error saving categories:', error);
    throw error;
  }
}

/**
 * Add a new category
 */
export async function addCategory(label: string): Promise<Category> {
  const categories = await getCategories();

  // Generate a key from the label
  const key = label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

  // Check if key already exists
  if (categories.some(c => c.key === key)) {
    throw new Error('Une catégorie avec ce nom existe déjà');
  }

  const newCategory: Category = {
    id: Date.now().toString(),
    key,
    label,
    isDefault: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await saveCategories([...categories, newCategory]);
  return newCategory;
}

/**
 * Update a category
 */
export async function updateCategory(id: string, label: string): Promise<void> {
  const categories = await getCategories();
  const categoryIndex = categories.findIndex(c => c.id === id);

  if (categoryIndex === -1) {
    throw new Error('Catégorie non trouvée');
  }

  // Generate new key from label
  const key = label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

  // Check if key already exists (excluding current category)
  if (categories.some(c => c.key === key && c.id !== id)) {
    throw new Error('Une catégorie avec ce nom existe déjà');
  }

  const oldKey = categories[categoryIndex].key;

  categories[categoryIndex] = {
    ...categories[categoryIndex],
    key,
    label,
    updatedAt: new Date().toISOString(),
  };

  await saveCategories(categories);

  // Update products that use the old key
  if (oldKey !== key) {
    const products = await getProducts();
    const updatedProducts = products.map(p =>
      p.category === oldKey ? { ...p, category: key, updatedAt: new Date().toISOString() } : p
    );
    await saveProducts(updatedProducts);
  }
}

/**
 * Delete a category (only custom categories can be deleted)
 */
export async function deleteCategory(id: string): Promise<void> {
  const categories = await getCategories();
  const category = categories.find(c => c.id === id);

  if (!category) {
    throw new Error('Catégorie non trouvée');
  }

  if (category.isDefault) {
    throw new Error('Les catégories par défaut ne peuvent pas être supprimées');
  }

  // Check if any products use this category
  const products = await getProducts();
  const productsInCategory = products.filter(p => p.category === category.key);

  if (productsInCategory.length > 0) {
    throw new Error(
      `${productsInCategory.length} produit(s) utilisent cette catégorie. Modifiez-les d'abord.`
    );
  }

  await saveCategories(categories.filter(c => c.id !== id));
}

/**
 * Initialize categories with defaults if empty
 */
export async function initializeDefaultCategories(): Promise<void> {
  const existingCategories = await getCategories();
  if (existingCategories.length === 0) {
    const defaultCats = DEFAULT_CATEGORIES.map(cat => ({
      ...cat,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    await saveCategories(defaultCats);
  }
}
