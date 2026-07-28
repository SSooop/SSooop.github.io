/**
 * Schema.org TypeScript Interfaces
 *
 * Type definitions for structured data markup
 * Based on: https://schema.org/docs/schemas.html
 */

// Base interface for all schema types
export interface BaseSchema {
  '@context'?: string;
  '@id'?: string;
  '@type': string;
}

// WebSite Schema
export interface WebSiteSchema extends BaseSchema {
  '@type': 'WebSite';
  name: string;
  url: string;
  description?: string;
  alternateName?: string;
  author?: PersonSchema | OrganizationSchema;
  publisher?: PersonSchema | OrganizationSchema;
  inLanguage?: string;
  potentialAction?: SearchActionSchema;
}

// SearchAction for WebSite
export interface SearchActionSchema {
  '@type': 'SearchAction';
  target: string;
  'query-input'?: string;
}

// Person Schema
export interface PersonSchema extends BaseSchema {
  '@type': 'Person';
  name: string;
  url?: string;
  image?: string;
  sameAs?: string[]; // Social media links
  jobTitle?: string;
  description?: string;
  worksFor?: OrganizationSchema;
  email?: string;
  birthDate?: string; // ISO date format
  birthPlace?: PlaceSchema;
  nationality?: string;
  knowsAbout?: string[]; // Topics of expertise
  inLanguage?: string;
}

// Organization Schema
export interface OrganizationSchema extends BaseSchema {
  '@type': 'Organization';
  name: string;
  url?: string;
  logo?: string;
  description?: string;
  sameAs?: string[];
  inLanguage?: string;
}

// BlogPosting Schema (extends Article)
export interface BlogPostingSchema extends BaseSchema {
  '@type': 'BlogPosting';
  headline: string;
  description?: string;
  image?: string | string[];
  author: PersonSchema | OrganizationSchema;
  publisher?: OrganizationSchema;
  datePublished: string; // ISO date format
  dateModified?: string; // ISO date format
  keywords?: string | string[];
  inLanguage?: string;
  url?: string;
  mainEntityOfPage?: WebPageSchema;
  genre?: string;
  articleSection?: string;
  wordCount?: number;
  sameAs?: string[];
}

// WebPage Schema
export interface WebPageSchema extends BaseSchema {
  '@type': 'WebPage';
  name?: string;
  url?: string;
  description?: string;
  datePublished?: string;
  dateModified?: string;
  author?: PersonSchema | OrganizationSchema;
  publisher?: OrganizationSchema;
  inLanguage?: string;
  isPartOf?: WebSiteSchema;
  about?: ThingSchema;
}

// BreadcrumbList Schema
export interface BreadcrumbListSchema extends BaseSchema {
  '@type': 'BreadcrumbList';
  itemListElement: BreadcrumbItemSchema[];
  numberOfItems: number;
}

export interface BreadcrumbItemSchema {
  '@type': 'ListItem';
  position: number;
  name: string;
  item?: string; // URL
  nextItem?: BreadcrumbItemSchema;
}

// Place Schema
export interface PlaceSchema extends BaseSchema {
  '@type': 'Place';
  name: string;
  address?: PostalAddressSchema;
  geo?: GeoCoordinatesSchema;
}

// PostalAddress Schema
export interface PostalAddressSchema extends BaseSchema {
  '@type': 'PostalAddress';
  streetAddress?: string;
  addressLocality?: string;
  addressRegion?: string;
  postalCode?: string;
  addressCountry?: string;
}

// GeoCoordinates Schema
export interface GeoCoordinatesSchema {
  latitude: number;
  longitude: number;
}

// Thing Schema (generic base type)
export interface ThingSchema extends BaseSchema {
  '@type': 'Thing';
  name: string;
  description?: string;
  url?: string;
  sameAs?: string[];
}
