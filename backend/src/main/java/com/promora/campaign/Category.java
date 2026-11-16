package com.promora.campaign;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "campaign_categories")
@Getter
@Setter
public class Category {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(nullable = false) private String name;
    @Column(nullable = false) private String slug;
    private String description;
    @Column(nullable = false) private String icon = "Tag";
    @Column(nullable = false) private boolean active = true;
    @Column(name = "sort_order", nullable = false) private int sortOrder;
}
